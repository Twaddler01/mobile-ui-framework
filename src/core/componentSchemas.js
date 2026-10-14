const enumOf = (...values) => ({
    kind: "enum",
    values
});

export const COMMON_PROPERTIES = Object.freeze({
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

function validateSchema(type, schema) {
    if (typeof type !== "string" || !/^[a-z][a-zA-Z0-9-]*$/.test(type)) {
        throw new TypeError(`Invalid component schema name "${type}".`);
    }

    if (!isPlainObject(schema)) {
        throw new TypeError(`Schema "${type}" must be a plain object.`);
    }

    const allowedSchemaKeys = new Set(["properties", "defaults"]);

    for (const key of Object.keys(schema)) {
        if (!allowedSchemaKeys.has(key)) {
            throw new TypeError(
                `Unknown schema setting "${key}" in "${type}".`
            );
        }
    }

    const properties = schema.properties ?? {};
    const defaults = schema.defaults ?? {};

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

    for (const [name, rule] of Object.entries(properties)) {
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

        if (
            rule.kind === "enum" &&
            (!Array.isArray(rule.values) || rule.values.length === 0)
        ) {
            throw new TypeError(
                `Enum "${type}.${name}" must declare at least one allowed value.`
            );
        }
    }

    for (const name of Object.keys(defaults)) {
        if (
            !Object.hasOwn(properties, name) &&
            !Object.hasOwn(COMMON_PROPERTIES, name)
        ) {
            throw new TypeError(
                `Default "${type}.${name}" has no declared property rule.`
            );
        }
    }

    return {
        properties: { ...properties },
        defaults: { ...defaults }
    };
}

/**
 * Register a component schema.
 *
 * Existing names are protected unless { replace: true } is supplied.
 * Component implementations and renderer support must be added separately.
 */
export function registerComponentSchema(type, schema, options = {}) {
    const normalized = validateSchema(type, schema);

    if (registry.has(type) && options.replace !== true) {
        throw new Error(`Component schema "${type}" is already registered.`);
    }

    registry.set(
        type,
        Object.freeze({
            properties: Object.freeze({
                ...normalized.properties
            }),
            defaults: Object.freeze({
                ...normalized.defaults
            })
        })
    );

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

// Compatibility export for existing code.
// Prefer getComponentSchema() for lookups and
// registerComponentSchema() for additions.
export const COMPONENT_SCHEMAS = Object.freeze(Object.fromEntries(registry));
