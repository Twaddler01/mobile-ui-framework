"tests/screenHost.test.js";

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
    Element,
    Screen,
    ScreenRegistry,
    ScreenManager,
    TabNavigator
} from "../src/ui.js";

import ScreenHost from "../src/navigation/ScreenHost.js";
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

function createRegistry() {
    return new ScreenRegistry({
        Home: Screen(() => Element({}, ["Home screen"])),
        Details: Screen(() => Element({}, ["Details screen"])),
        Settings: Screen(() => Element({}, ["Settings screen"]))
    });
}

test("mount renders the current screen", () => {
    const manager = new ScreenManager(createRegistry());
    manager.navigate("Home");

    const host = new ScreenHost(manager);
    const container = createContainer();

    host.mount(container);

    assert.equal(container.textContent, "Home screen");
    assert.equal(container.children.length, 1);
});

test("mount renders the current output from a TabNavigator", () => {
    const navigator = new TabNavigator(createRegistry(), [
        {
            id: "home",
            label: "Home",
            screen: "Home"
        },
        {
            id: "settings",
            label: "Settings",
            screen: "Settings"
        }
    ]);

    const host = new ScreenHost(navigator, { transition: false });
    const container = createContainer();

    host.mount(container);

    assert.equal(container.textContent, "Home screen");

    navigator.selectTab("settings");

    assert.equal(container.textContent, "Settings screen");
});

test("screen changes update the rendered DOM", () => {
    const manager = new ScreenManager(createRegistry());
    manager.navigate("Home");

    const host = new ScreenHost(manager, { transition: false });
    const container = createContainer();

    host.mount(container);
    manager.navigate("Details");

    assert.equal(container.textContent, "Details screen");
});

test("unmount removes the navigation listener", () => {
    const manager = new ScreenManager(createRegistry());
    manager.navigate("Home");

    const host = new ScreenHost(manager);
    const container = createContainer();

    host.mount(container);
    host.unmount();

    assert.equal(container.childNodes.length, 0);

    manager.navigate("Details");

    assert.equal(container.childNodes.length, 0);
});

test("mount rejects invalid containers", () => {
    const manager = new ScreenManager(createRegistry());
    manager.navigate("Home");

    const host = new ScreenHost(manager);

    assert.throws(() => host.mount({}), /valid DOM container/i);
});

test("unmount is safe when called more than once", () => {
    const manager = new ScreenManager(createRegistry());
    manager.navigate("Home");

    const host = new ScreenHost(manager, { transition: false });
    const container = createContainer();

    host.mount(container);

    assert.doesNotThrow(() => {
        host.unmount();
        host.unmount();
    });
});
