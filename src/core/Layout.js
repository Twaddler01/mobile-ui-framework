const ALIGN_VALUES = new Set(["start", "center", "end", "stretch"]);

const JUSTIFY_VALUES = new Set([
    "start",
    "center",
    "end",
    "between",
    "around",
    "evenly"
]);

const SIZE_PROPERTIES = ["gap", "padding", "width", "height"];

function validateSize(name, value) {
    if (value == null) {
        return;
    }

    const valid =
        (typeof value === "number" && Number.isFinite(value) && value >= 0) ||
        (typeof value === "string" && value.trim().length > 0);

    if (!valid) {
        throw new TypeError(
            `Layout "${name}" must be a non-negative number or a non-empty CSS size string.`
        );
    }
}

export function normalizeLayoutProps(props = {}) {
    const layout = {};

    for (const name of SIZE_PROPERTIES) {
        const value = props[name];

        validateSize(name, value);

        if (value != null) {
            layout[name] = value;
        }
    }

    if (props.align != null) {
        if (!ALIGN_VALUES.has(props.align)) {
            throw new TypeError(
                `Invalid layout align value: "${props.align}".`
            );
        }

        layout.align = props.align;
    }

    if (props.justify != null) {
        if (!JUSTIFY_VALUES.has(props.justify)) {
            throw new TypeError(
                `Invalid layout justify value: "${props.justify}".`
            );
        }

        layout.justify = props.justify;
    }

    return layout;
}
