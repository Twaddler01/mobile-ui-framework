const enumOf = (...values) => ({
    kind: "enum",
    values
});

export const COMMON_PROPERTIES = deepFreeze({
    width: { kind: "size" },
    height: { kind: "size" },
    padding: { kind: "size" },
    gap: { kind: "size" },

    align: enumOf("start", "center", "end", "stretch"),
    justify: enumOf("start", "center", "end", "between", "around", "evenly"),
    wrap: enumOf("wrap", "nowrap", "wrap-reverse", true, false),

    className: { kind: "string" },
    style: { kind: "style" },
    attributes: { kind: "attributes" },
    onClick: { kind: "function" }
});

const registry = new Map();

const VALID_SCHEMA_KINDS = new Set([
    "size",
    "number",
    "enum",
    "string",
    "boolean",
    "function",
    "tagName",
    "fontWeight",
    "style",
    "attributes"
]);

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

/**
 * Clone and freeze schema data recursively.
 * Functions are retained as-is so custom validators remain callable.
 */

function deepFreeze(value, seen = new WeakMap()) {
    if (
        value === null ||
        (typeof value !== "object" && typeof value !== "function")
    ) {
        return value;
    }

    if (typeof value === "function") {
        return value;
    }

    if (seen.has(value)) {
        return seen.get(value);
    }

    const clone = Array.isArray(value)
        ? []
        : Object.create(Object.getPrototypeOf(value));

    seen.set(value, clone);

    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);

        if (descriptor && "value" in descriptor) {
            descriptor.value = deepFreeze(descriptor.value, seen);
        }

        Object.defineProperty(clone, key, descriptor);
    }

    return Object.freeze(clone);
}

function validateSchema(type, schema) {
    if (typeof type !== "string" || !/^[a-z][a-zA-Z0-9-]*$/.test(type)) {
        throw new TypeError(`Invalid component schema name "${type}".`);
    }

    if (!isPlainObject(schema)) {
        throw new TypeError(`Schema "${type}" must be a plain object.`);
    }

    const allowedSchemaKeys = new Set(["properties", "defaults", "required"]);

    for (const key of Object.keys(schema)) {
        if (!allowedSchemaKeys.has(key)) {
            throw new TypeError(
                `Unknown schema setting "${key}" in "${type}".`
            );
        }
    }

    const properties = schema.properties ?? {};
    const defaults = schema.defaults ?? {};
    const required = schema.required ?? [];

    if (!isPlainObject(properties)) {
        throw new TypeError(
            `Schema "${type}" properties must be a plain object.`
        );
    }

    if (!isPlainObject(defaults)) {
        throw new TypeError(
            `Schema "${type}" defaults must be a plain object.`
        );
    }

    if (
        !Array.isArray(required) ||
        !required.every(name => typeof name === "string") ||
        new Set(required).size !== required.length
    ) {
        throw new TypeError(
            `Schema "${type}" required must be an array of unique property names.`
        );
    }

    const propertyRules = {};

    for (const [name, rule] of Object.entries(properties)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
            throw new TypeError(
                `Invalid property name "${name}" in schema "${type}".`
            );
        }

        if (!isPlainObject(rule)) {
            throw new TypeError(
                `Schema "${type}" property "${name}" must have a rule object.`
            );
        }

        if (!VALID_SCHEMA_KINDS.has(rule.kind)) {
            throw new TypeError(
                `Unsupported rule kind "${rule.kind}" for "${type}.${name}".`
            );
        }

        const allowedRuleKeys = new Set([
            "kind",
            "values",
            "validate",
            "message"
        ]);

        for (const key of Object.keys(rule)) {
            if (!allowedRuleKeys.has(key)) {
                throw new TypeError(
                    `Unknown rule setting "${key}" for "${type}.${name}".`
                );
            }
        }

        if (
            rule.kind === "enum" &&
            (!Array.isArray(rule.values) || rule.values.length === 0)
        ) {
            throw new TypeError(
                `Enum "${type}.${name}" must declare at least one allowed value.`
            );
        }

        if (
            rule.kind === "enum" &&
            rule.values.some(
                value =>
                    value !== null &&
                    !["string", "number", "boolean"].includes(typeof value)
            )
        ) {
            throw new TypeError(
                `Enum "${type}.${name}" may contain only primitive values.`
            );
        }

        if (
            rule.validate !== undefined &&
            typeof rule.validate !== "function"
        ) {
            throw new TypeError(
                `Custom validator for "${type}.${name}" must be a function.`
            );
        }

        if (rule.message !== undefined && typeof rule.message !== "string") {
            throw new TypeError(
                `Validation message for "${type}.${name}" must be a string.`
            );
        }

        propertyRules[name] = rule;
    }

    for (const name of required) {
        if (
            !Object.hasOwn(propertyRules, name) &&
            !Object.hasOwn(COMMON_PROPERTIES, name)
        ) {
            throw new TypeError(
                `Required property "${type}.${name}" has no declared property rule.`
            );
        }
    }

    for (const name of Object.keys(defaults)) {
        if (
            !Object.hasOwn(propertyRules, name) &&
            !Object.hasOwn(COMMON_PROPERTIES, name)
        ) {
            throw new TypeError(
                `Default "${type}.${name}" has no declared property rule.`
            );
        }
    }

    return deepFreeze({
        properties: propertyRules,
        defaults: { ...defaults },
        required: [...required]
    });
}

/**
 * Register a component schema.
 *
 * Existing names are protected unless { replace: true } is supplied.
 * Component implementations and renderer support must be added separately.
 */
export function registerComponentSchema(type, schema, options = {}) {
    if (!isPlainObject(options)) {
        throw new TypeError(
            "Schema registration options must be a plain object."
        );
    }

    for (const key of Object.keys(options)) {
        if (key !== "replace") {
            throw new TypeError(`Unknown registration option "${key}".`);
        }
    }

    if (options.replace !== undefined && typeof options.replace !== "boolean") {
        throw new TypeError('Registration option "replace" must be a boolean.');
    }

    if (registry.has(type) && options.replace !== true) {
        throw new Error(`Component schema "${type}" is already registered.`);
    }

    const normalized = validateSchema(type, schema);

    registry.set(type, normalized);

    return getComponentSchema(type);
}

export function getComponentSchema(type) {
    return registry.get(type) ?? null;
}

export function hasComponentSchema(type) {
    return registry.has(type);
}

export function listComponentTypes() {
    return [...registry.keys()];
}

// Built-in schemas.
const BUILT_IN_SCHEMAS = {
    element: {
        properties: {
            tagName: { kind: "tagName" }
        },
        defaults: {
            tagName: "div"
        }
    },

    text: {
        properties: {
            tagName: { kind: "tagName" },
            size: enumOf("small", "medium", "large", "title"),
            color: { kind: "string" },
            weight: { kind: "fontWeight" },
            align: enumOf("left", "center", "right", "start", "end", "justify")
        },
        defaults: {
            tagName: "p",
            size: "medium",
            weight: 400,
            align: "left"
        }
    },

    button: {
        properties: {
            variant: enumOf("primary", "secondary", "ghost"),
            size: enumOf("small", "medium", "large"),
            disabled: { kind: "boolean" },
            type: enumOf("button", "submit", "reset")
        },
        defaults: {
            variant: "primary",
            size: "medium",
            disabled: false,
            type: "button"
        }
    },

    card: {
        properties: {},
        defaults: {}
    },

    row: {
        properties: {},
        defaults: {}
    },

    column: {
        properties: {},
        defaults: {}
    },

    fragment: {
        properties: {},
        defaults: {}
    }
};

for (const [type, schema] of Object.entries(BUILT_IN_SCHEMAS)) {
    registerComponentSchema(type, schema);
}

// Compatibility snapshot. Use getComponentSchema() for live registry lookups.
export const COMPONENT_SCHEMAS = deepFreeze(Object.fromEntries(registry));
