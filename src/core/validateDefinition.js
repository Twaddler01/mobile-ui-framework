import validateComponent from "./validateComponent.js";

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

export default function validateDefinition(definition) {
    const errors = [];
    const activePath = new WeakSet();

    function visit(node, path) {
        if (typeof node === "string") {
            return;
        }

        if (typeof node === "number") {
            if (!Number.isFinite(node)) {
                errors.push(
                    `${path}: Numeric children must be finite numbers.`
                );
            }

            return;
        }

        if (node === null || typeof node !== "object") {
            errors.push(`${path}: Invalid component or child.`);
            return;
        }

        if (activePath.has(node)) {
            errors.push(
                `${path}: Circular component references are not allowed.`
            );
            return;
        }

        activePath.add(node);

        try {
            if (Array.isArray(node)) {
                node.forEach((child, index) => {
                    visit(child, `${path}[${index}]`);
                });

                return;
            }

            if (
                !isPlainObject(node) &&
                !(
                    typeof node.type === "string" &&
                    "props" in node &&
                    "children" in node
                )
            ) {
                errors.push(
                    `${path}: Expected a plain-object definition or component instance.`
                );

                return;
            }

            if (typeof node.type !== "string") {
                errors.push(`${path}: Component type must be a string.`);

                return;
            }

            const props = node.props ?? {};
            const children = node.children ?? [];

            errors.push(...validateComponent(node.type, props, path));

            if (!Array.isArray(children)) {
                errors.push(`${path}: Component children must be an array.`);

                return;
            }

            children.forEach((child, index) => {
                visit(child, `${path}.children[${index}]`);
            });
        } finally {
            activePath.delete(node);
        }
    }

    // A root must be a component definition or an array of nodes.
    if (definition === null || typeof definition !== "object") {
        return {
            valid: false,
            errors: ["root: The UI root must be a component or array."]
        };
    }

    visit(definition, "root");

    return {
        valid: errors.length === 0,
        errors
    };
}
