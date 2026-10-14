import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { Column, Text, Button } from "../src/ui.js";
import DOMRenderer from "../src/renderers/dom/DOMRenderer.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element;

after(() => {
    dom.window.close();
});

function createContainer() {
    return document.createElement("main");
}

test("public factories render a nested component tree", () => {
    const renderer = new DOMRenderer();
    const container = createContainer();

    const view = Column({ gap: 12, padding: 16 }, [
        Text(
            {
                size: "title",
                color: "red",
                align: "center"
            },
            ["Welcome"]
        ),
        Button({ variant: "primary" }, ["Continue"])
    ]);

    const root = renderer.render(view, container);

    assert.equal(root, container.firstElementChild);
    assert.ok(root.classList.contains("ui-column"));
    assert.equal(root.style.gap, "12px");
    assert.equal(root.style.padding, "16px");

    const heading = root.querySelector("p.ui-text");

    assert.ok(heading);
    assert.equal(heading.textContent, "Welcome");
    assert.ok(heading.classList.contains("ui-text-title"));
    assert.equal(heading.style.color, "red");
    assert.equal(heading.style.textAlign, "center");

    const button = root.querySelector("button");

    assert.ok(button);
    assert.equal(button.textContent, "Continue");
    assert.ok(button.classList.contains("ui-button-primary"));
    assert.ok(button.classList.contains("ui-button-medium"));
    assert.equal(button.disabled, false);
});

test("button attributes, styles, and click handlers work", () => {
    const renderer = new DOMRenderer();
    const container = createContainer();

    let clickCount = 0;

    const view = Button(
        {
            attributes: {
                "aria-label": "Save changes"
            },
            style: {
                marginTop: "8px"
            },
            onClick: () => {
                clickCount++;
            }
        },
        ["Save"]
    );

    renderer.render(view, container);

    const button = container.querySelector("button");

    assert.ok(button);
    assert.equal(button.getAttribute("aria-label"), "Save changes");
    assert.equal(button.style.marginTop, "8px");

    button.dispatchEvent(
        new dom.window.Event("click", {
            bubbles: true
        })
    );

    assert.equal(clickCount, 1);
});

test("disabled buttons render with their disabled state", () => {
    const renderer = new DOMRenderer();
    const container = createContainer();

    renderer.render(Button({ disabled: true }, ["Unavailable"]), container);

    const button = container.querySelector("button");

    assert.ok(button.disabled);
    assert.equal(button.type, "button");
});

test("root arrays render as fragments with text and numbers", () => {
    const renderer = new DOMRenderer();
    const container = createContainer();

    renderer.render([Text({}, ["First"]), " middle ", 42], container);

    assert.equal(container.textContent, "First middle 42");
    assert.equal(container.querySelectorAll("p").length, 1);
    assert.equal(container.childNodes.length, 3);
});

test("invalid definitions do not replace existing content", () => {
    const renderer = new DOMRenderer();
    const container = createContainer();

    const existing = document.createElement("span");
    existing.textContent = "Keep me";
    container.appendChild(existing);

    assert.throws(() => {
        renderer.render(
            {
                type: "button",
                props: {
                    variant: "not-a-variant"
                },
                children: ["Invalid"]
            },
            container
        );
    }, /validation failed/i);

    assert.equal(container.firstElementChild, existing);
    assert.equal(container.textContent, "Keep me");
});

test("unsupported properties fail before DOM rendering", () => {
    const renderer = new DOMRenderer();
    const container = createContainer();

    assert.throws(() => {
        renderer.render(
            {
                type: "text",
                props: {
                    colour: "blue"
                },
                children: ["Hello"]
            },
            container
        );
    }, /unsupported property/i);

    assert.equal(container.childNodes.length, 0);
});
