import Component from "./src/core/Component.js";
import Column from "./src/components/Column.js";
import Row from "./src/components/Row.js";
import Card from "./src/components/Card.js";
import Button from "./src/components/Button.js";
import DOMRenderer from "./src/renderers/dom/DOMRenderer.js";

const renderer = new DOMRenderer();

const workspace = document.querySelector("#workspace-content");

function element(tagName, props = {}, children = []) {
    return new Component(
        "element",
        {
            tagName,
            ...props
        },
        children
    );
}

function renderLandingWorkspace() {
    const view = new Column(
        {
            gap: 16,
            padding: 20,
            align: "stretch"
        },
        [
            element("h3", {}, ["Layout test"]),

            new Row(
                {
                    gap: 12,
                    align: "center",
                    justify: "between"
                },
                [
                    element(
                        "div",
                        {
                            style: {
                                background: "#19263b",
                                padding: "16px",
                                borderRadius: "10px",
                                flex: "1"
                            }
                        },
                        ["First item"]
                    ),

                    element(
                        "div",
                        {
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
            element("h3", {}, ["Button Test"]),

            element("p", {}, [
                "These buttons use the framework component API."
            ]),

            new Row(
                {
                    gap: 10,
                    align: "center",
                    wrap: "wrap"
                },
                [
                    new Button(
                        {
                            variant: "primary",
                            onClick: () => console.log("Primary clicked!")
                        },
                        ["Primary"]
                    ),

                    new Button(
                        {
                            variant: "secondary",
                            onClick: () => console.log("Secondary clicked!")
                        },
                        ["Secondary"]
                    ),

                    new Button(
                        {
                            variant: "ghost",
                            size: "small",
                            onClick: () => console.log("Ghost clicked!")
                        },
                        ["Ghost"]
                    )
                ]
            ),

            new Button(
                {
                    variant: "secondary",
                    disabled: true
                },
                ["Disabled"]
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
