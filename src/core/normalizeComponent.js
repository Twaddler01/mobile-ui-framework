import { getComponentSchema } from "./componentSchemas.js";
import validateDefinition from "./validateDefinition.js";

function normalizeNode(node) {
    if (typeof node === "string" || typeof node === "number") {
        return node;
    }

    if (Array.isArray(node)) {
        return {
            type: "fragment",
            props: {},
            children: node.map(normalizeNode)
        };
    }

    const schema = getComponentSchema(node.type);

    if (!schema) {
        throw new TypeError(
            `Unknown component type "${node.type}".`
        );
    }

    const props = {
        ...schema.defaults,
        ...node.props
    };

    const children = (node.children ?? []).map(normalizeNode);

    return {
        type: node.type,
        props,
        children
    };
}

export default function normalizeComponent(component) {
    const result = validateDefinition(component);

    if (!result.valid) {
        throw new TypeError(
            `UI definition validation failed:\n- ${result.errors.join("\n- ")}`
        );
    }

    return normalizeNode(component);
}
