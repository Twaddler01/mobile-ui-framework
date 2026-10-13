import { Element, Text, Button, Card, Row, Column } from "./src/ui.js";

import DOMRenderer from "./src/renderers/dom/DOMRenderer.js";

const renderer = new DOMRenderer();

const workspace = document.querySelector("#workspace-content");

function renderLandingWorkspace() {
    const view = new Column(
        {
            gap: 16,
            padding: 20,
            align: "stretch"
        },
        [
            Element(
                {
                    tagName: "h3"
                },
                ["Button Test"]
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
    const view = new Card(
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

            new Button(
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
    //renderLandingWorkspace();
    renderExample();

    console.log("Mobile UI Framework started.");
}

startApplication();
