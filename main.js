import {
    Element,
    Text,
    Button,
    Card,
    Row,
    Column,
    validateDefinition,
    normalizeComponent
} from "./src/ui.js";

import DOMRenderer from "./src/renderers/dom/DOMRenderer.js";

const renderer = new DOMRenderer();
const workspace = document.querySelector("#workspace-content");

function renderLandingWorkspace() {
    const view = Column(
        {
            gap: 16,
            padding: 20,
            align: "stretch"
        },
        [
            Element(
                {
                    tagName: "button",
                    onClick: renderExample
                },
                ["renderExample"]
            ),

            Row(
                {
                    gap: 12,
                    align: "center",
                    justify: "between"
                },
                [
                    Element(
                        {
                            tagName: "div",
                            style: {
                                background: "#19263b",
                                padding: "16px",
                                borderRadius: "10px",
                                flex: "1"
                            }
                        },
                        ["First item"]
                    ),

                    Element(
                        {
                            tagName: "div",
                            style: {
                                background: "#19263b",
                                padding: "16px",
                                borderRadius: "10px",
                                flex: "1"
                            }
                        },
                        ["Second item"]
                    )
                ]
            )
        ]
    );

    renderer.render(view, workspace);
}

function renderExample() {
    const view = Card(
        {
            width: "100%",
            padding: 20,
            gap: 12
        },
        [
            Element(
                {
                    tagName: "h2"
                },
                ["Element Component Test"]
            ),

            Element(
                {
                    tagName: "p",
                    className: "description",
                    style: {
                        color: "var(--color-muted)"
                    }
                },
                ["Generic HTML elements can contain text and other components."]
            ),

            Element(
                {
                    tagName: "div",
                    attributes: {
                        "data-testid": "element-demo"
                    },
                    style: {
                        padding: "12px",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px"
                    }
                },
                [
                    Text(
                        {
                            weight: 700
                        },
                        ["Nested Text component"]
                    ),

                    Element(
                        {
                            tagName: "p"
                        },
                        ["Nested generic paragraph."]
                    )
                ]
            ),

            Button(
                {
                    onClick: renderLandingWorkspace
                },
                ["Back to Workspace"]
            )
        ]
    );

    renderer.render(view, workspace);
}

function startApplication() {
    renderLandingWorkspace(); // 1.
    //renderExample(); // 2.

    //debugArea1();

    console.log("Mobile UI Framework started.");
}

startApplication();

/// DEBUGGING ////

// Test valid / invalid definitiond
function debugArea1() {
    const validView = Column(
        {
            padding: 20,
            gap: 12,
            align: "stretch"
        },
        [
            Text(
                {
                    size: "title",
                    weight: 700
                },
                ["Welcome"]
            ),
            Button(
                {
                    variant: "primary"
                },
                ["Continue"]
            )
        ]
    );

    const result = validateDefinition(validView);

    console.log(result);

    // Expected:
    // { valid: true, errors: [] }

    if (result.valid) {
        const normalized = normalizeComponent(validView);
        renderer.render(normalized, workspace);
    }

    const invalidView = {
        type: "column",
        props: {
            gap: -10,
            align: "middle"
        },
        children: [
            {
                type: "button",
                props: {
                    variant: "mystery"
                },
                children: ["Test"]
            },
            {
                type: "text",
                props: {
                    colour: "red"
                },
                children: ["Invalid property"]
            }
        ]
    };

    console.log(validateDefinition(invalidView));
}
