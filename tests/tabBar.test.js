import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
    Screen,
    ScreenRegistry,
    TabNavigator,
    TabBar,
    Element
} from "../src/ui.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element;

after(() => dom.window.close());

function createRegistry() {
    return new ScreenRegistry({
        Home: Screen(() => Element({}, ["Home screen"])),
        Search: Screen(() => Element({}, ["Search screen"])),
        Settings: Screen(() => Element({}, ["Settings screen"]))
    });
}

function createNavigator() {
    return new TabNavigator(createRegistry(), [
        {
            id: "home",
            label: "Home",
            icon: "⌂",
            screen: "Home"
        },
        {
            id: "search",
            label: "Search",
            icon: "⌕",
            screen: "Search"
        },
        {
            id: "settings",
            label: "Settings",
            screen: "Settings"
        }
    ]);
}

function createContainer() {
    return document.createElement("nav");
}

test("TabBar renders the configured tabs", () => {
    const navigator = createNavigator();
    const tabBar = TabBar(navigator);
    const container = createContainer();

    tabBar.mount(container);

    assert.equal(container.querySelectorAll('[role="tab"]').length, 3);

    assert.equal(
        container.querySelector('[data-tab-id="home"]').textContent,
        "⌂Home"
    );

    assert.equal(
        container.querySelector('[data-tab-id="search"]').textContent,
        "⌕Search"
    );

    assert.equal(
        container.querySelector('[data-tab-id="settings"]').textContent,
        "Settings"
    );

    tabBar.unmount();
});

test("TabBar marks the selected tab accessibly", () => {
    const navigator = createNavigator();
    const tabBar = TabBar(navigator);
    const container = createContainer();

    tabBar.mount(container);

    const home = container.querySelector('[data-tab-id="home"]');

    const search = container.querySelector('[data-tab-id="search"]');

    assert.equal(home.getAttribute("aria-selected"), "true");
    assert.equal(search.getAttribute("aria-selected"), "false");
    assert.equal(home.classList.contains("is-selected"), true);
    assert.equal(search.classList.contains("is-selected"), false);

    tabBar.unmount();
});

test("TabBar creates a tab list with accessible labels", () => {
    const tabBar = TabBar(createNavigator());
    const container = createContainer();

    tabBar.mount(container);

    assert.ok(container.querySelector('[role="tablist"]'));

    for (const button of container.querySelectorAll('[role="tab"]')) {
        assert.ok(button.getAttribute("aria-label"));
        assert.equal(button.tagName, "BUTTON");
    }

    tabBar.unmount();
});

test("clicking a tab changes the selected navigation tab", () => {
    const navigator = createNavigator();
    const tabBar = TabBar(navigator);
    const container = createContainer();

    tabBar.mount(container);

    container.querySelector('[data-tab-id="search"]').click();

    assert.equal(navigator.selectedTabId, "search");

    assert.equal(
        container
            .querySelector('[data-tab-id="search"]')
            .getAttribute("aria-selected"),
        "true"
    );

    assert.equal(
        container
            .querySelector('[data-tab-id="home"]')
            .getAttribute("aria-selected"),
        "false"
    );

    tabBar.unmount();
});

test("TabBar updates when navigation changes programmatically", () => {
    const navigator = createNavigator();
    const tabBar = TabBar(navigator);
    const container = createContainer();

    tabBar.mount(container);

    navigator.selectTab("settings");

    assert.equal(
        container
            .querySelector('[data-tab-id="settings"]')
            .getAttribute("aria-selected"),
        "true"
    );

    assert.equal(
        container
            .querySelector('[data-tab-id="home"]')
            .getAttribute("aria-selected"),
        "false"
    );

    tabBar.unmount();
});

test("TabBar unmount clears its container", () => {
    const tabBar = TabBar(createNavigator());
    const container = createContainer();

    tabBar.mount(container);
    assert.ok(container.childElementCount > 0);

    tabBar.unmount();

    assert.equal(container.childElementCount, 0);
});

test("TabBar can be unmounted more than once", () => {
    const tabBar = TabBar(createNavigator());
    const container = createContainer();

    tabBar.mount(container);

    assert.doesNotThrow(() => {
        tabBar.unmount();
        tabBar.unmount();
    });
});

test("TabBar rejects invalid containers", () => {
    const tabBar = TabBar(createNavigator());

    assert.throws(() => tabBar.mount({}), /valid DOM container/);
});

test("TabBar rejects mounting twice without unmounting", () => {
    const tabBar = TabBar(createNavigator());

    tabBar.mount(createContainer());

    assert.throws(() => tabBar.mount(createContainer()), /already mounted/);

    tabBar.unmount();
});
