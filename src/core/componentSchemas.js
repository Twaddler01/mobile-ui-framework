
const enumOf = (...values) => ({
    kind: "enum",
    values
});

const COMMON_PROPERTIES = {
    width: { kind: "size" },
    height: { kind: "size" },
    padding: { kind: "size" },
    gap: { kind: "size" },

    align: enumOf(
        "start",
        "center",
        "end",
        "stretch"
    ),

    justify: enumOf(
        "start",
        "center",
        "end",
        "between",
        "around",
        "evenly"
    ),

    wrap: {
        kind: "enum",
        values: ["wrap", "nowrap", "wrap-reverse", true, false]
    },

    className: { kind: "string" },
    style: { kind: "style" },
    attributes: { kind: "attributes" },
    onClick: { kind: "function" }
};

const COMPONENT_SCHEMAS = {
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

            // Text alignment differs from flex alignment.
            align: enumOf(
                "left",
                "center",
                "right",
                "start",
                "end",
                "justify"
            )
        },
        defaults: {
            tagName: "p",
            size: "medium",
            color: undefined,
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

export { COMMON_PROPERTIES, COMPONENT_SCHEMAS };
