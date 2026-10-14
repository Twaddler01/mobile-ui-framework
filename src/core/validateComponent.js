import { COMMON_PROPERTIES, COMPONENT_SCHEMAS } from "./componentSchemas.js";

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

    // Leave actual CSS interpretation to the renderer.
    // Reject empty values and obvious CSS declaration injection.
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

function validateProperty(name, value, schema, errors, path) {
    let valid = true;

    switch (schema.kind) {
        case "size":
            valid = isValidSize(value);
            break;

        case "enum":
            valid = schema.values.includes(value);
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
            return;

        case "attributes":
            validateAttributes(value, errors, path);
            return;

        default:
            errors.push(
                `${path}: Unknown schema kind "${schema.kind}" for "${name}".`
            );
            return;
    }

    if (!valid) {
        errors.push(`${path}: Invalid value for property "${name}".`);
    }
}

export default function validateComponent(type, props = {}, path = "root") {
    const errors = [];
    const componentSchema = COMPONENT_SCHEMAS[type];

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

    for (const [name, value] of Object.entries(props)) {
        const schema = properties[name];

        if (!schema) {
            errors.push(
                `${path}: Unsupported property "${name}" for component type "${type}".`
            );
            continue;
        }

        // Optional values may be omitted or explicitly set to undefined.
        if (value === undefined) {
            continue;
        }

        validateProperty(name, value, schema, errors, path);
    }

    return errors;
}
