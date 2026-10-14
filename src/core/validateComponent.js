import { COMMON_PROPERTIES, getComponentSchema } from "./componentSchemas.js";

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

function isValidSize(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0;
    }

    if (typeof value !== "string") {
        return false;
    }

    const text = value.trim();

    return (
        text.length > 0 &&
        !/[;{}]/.test(text) &&
        !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)
    );
}

function isValidTagName(value) {
    return typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(value);
}

function isValidFontWeight(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 1 && value <= 1000;
    }

    return (
        typeof value === "string" &&
        /^(normal|bold|bolder|lighter|[1-9]00)$/.test(value)
    );
}

function validateStyle(value, errors, path) {
    if (!isPlainObject(value)) {
        errors.push(`${path}: "style" must be a plain object.`);
        return;
    }

    for (const [name, entry] of Object.entries(value)) {
        if (!/^(--[a-zA-Z0-9_-]+|[a-zA-Z][a-zA-Z0-9]*)$/.test(name)) {
            errors.push(`${path}: Invalid CSS property name "${name}".`);
            continue;
        }

        const validEntry =
            entry == null ||
            typeof entry === "string" ||
            (typeof entry === "number" && Number.isFinite(entry));

        if (!validEntry) {
            errors.push(
                `${path}: CSS property "${name}" must be a string, finite number, or null.`
            );
        }
    }
}

function validateAttributes(value, errors, path) {
    if (!isPlainObject(value)) {
        errors.push(`${path}: "attributes" must be a plain object.`);
        return;
    }

    for (const [name, entry] of Object.entries(value)) {
        if (!/^[a-zA-Z_:][a-zA-Z0-9:._-]*$/.test(name)) {
            errors.push(`${path}: Invalid HTML attribute name "${name}".`);
            continue;
        }

        const validEntry =
            entry == null ||
            typeof entry === "string" ||
            typeof entry === "number" ||
            typeof entry === "boolean";

        if (!validEntry) {
            errors.push(
                `${path}: Attribute "${name}" must be a string, number, boolean, or null.`
            );
        }
    }
}

function validateProperty(name, value, rule, props, errors, path) {
    let valid = true;

    switch (rule.kind) {
        case "size":
            valid = isValidSize(value);
            break;

        case "number":
            valid = typeof value === "number" && Number.isFinite(value);
            break;

        case "enum":
            valid = rule.values.includes(value);
            break;

        case "string":
            valid = typeof value === "string";
            break;

        case "boolean":
            valid = typeof value === "boolean";
            break;

        case "function":
            valid = typeof value === "function";
            break;

        case "tagName":
            valid = isValidTagName(value);
            break;

        case "fontWeight":
            valid = isValidFontWeight(value);
            break;

        case "style":
            validateStyle(value, errors, path);
            break;

        case "attributes":
            validateAttributes(value, errors, path);
            break;

        default:
            errors.push(
                `${path}: Unknown schema kind "${rule.kind}" for "${name}".`
            );
            return;
    }

    if (!valid) {
        errors.push(`${path}: Invalid value for property "${name}".`);
        return;
    }

    if (typeof rule.validate === "function") {
        try {
            const result = rule.validate(value, props);

            if (result !== true) {
                const message =
                    typeof result === "string"
                        ? result
                        : (rule.message ??
                          `Custom validation failed for property "${name}".`);

                errors.push(`${path}: ${message}`);
            }
        } catch (error) {
            errors.push(
                `${path}: Custom validator for "${name}" threw an error: ${error.message}`
            );
        }
    }
}

export default function validateComponent(type, props = {}, path = "root") {
    const errors = [];
    const componentSchema = getComponentSchema(type);

    if (!componentSchema) {
        return [`${path}: Unknown component type "${type}".`];
    }

    if (!isPlainObject(props)) {
        return [`${path}: Component props must be a plain object.`];
    }

    const properties = {
        ...COMMON_PROPERTIES,
        ...componentSchema.properties
    };

    for (const name of componentSchema.required) {
        if (!Object.hasOwn(props, name) || props[name] === undefined) {
            errors.push(
                `${path}: Required property "${name}" is missing for component type "${type}".`
            );
        }
    }

    for (const [name, value] of Object.entries(props)) {
        const rule = properties[name];

        if (!rule) {
            errors.push(
                `${path}: Unsupported property "${name}" for component type "${type}".`
            );
            continue;
        }

        // Optional values may be omitted or explicitly set to undefined.
        if (value === undefined) {
            continue;
        }

        validateProperty(name, value, rule, props, errors, path);
    }

    return errors;
}
