const VALID_TYPES = new Set([
    "element",
    "text",
    "button",
    "card",
    "row",
    "column",
    "fragment"
]);

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

function normalizeNode(node, path = "root") {
    // Text and numeric children are allowed.
    if (typeof node === "string" || typeof node === "number") {
        return node;
    }

    // Arrays become fragments, allowing grouped children.
    if (Array.isArray(node)) {
        return {
            type: "fragment",
            props: {},
            children: node.map((child, index) =>
                normalizeNode(child, `${path}[${index}]`)
            )
        };
    }

    if (!node || typeof node !== "object") {
        throw new TypeError(`Invalid component at ${path}.`);
    }

    const type = node.type;

    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
        throw new TypeError(`Unknown component type at ${path}: "${type}".`);
    }

    const props = node.props ?? {};
    const children = node.children ?? [];

    if (!isPlainObject(props)) {
        throw new TypeError(
            `Component props at ${path} must be a plain object.`
        );
    }

    if (!Array.isArray(children)) {
        throw new TypeError(`Component children at ${path} must be an array.`);
    }

    return {
        type,
        props: { ...props },
        children: children.map((child, index) =>
            normalizeNode(child, `${path}.children[${index}]`)
        )
    };
}

export default function normalizeComponent(component) {
    const normalized = normalizeNode(component);

    if (normalized === null || typeof normalized !== "object") {
        throw new TypeError(
            "The UI root must be a component or component definition."
        );
    }

    return normalized;
}
