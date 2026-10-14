import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
    Element,
    Screen,
    ScreenRegistry,
    TabNavigator,
    ScreenHost,
    TabBar
} from "../src/ui.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element;

after(() => dom.window.close());

function createRegistry() {
    return new ScreenRegistry({
        Home: Screen(() =>
            Element({ className: "screen-home" }, ["Home screen"])
        ),

        Details: Screen(() =>
            Element({ className: "screen-details" }, ["Details screen"])
        ),

        Search: Screen(() =>
            Element({ className: "screen-search" }, ["Search screen"])
        ),

        Settings: Screen(() =>
            Element({ className: "screen-settings" }, ["Settings screen"])
        )
    });
}

function createApp() {
    const registry = createRegistry();

    const navigation = new TabNavigator(registry, [
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

    const screenContainer = document.createElement("main");
    const tabContainer = document.createElement("nav");

    const screenHost = new ScreenHost(navigation);
    const tabBar = TabBar(navigation);

    screenHost.mount(screenContainer);
    tabBar.mount(tabContainer);

    document.body.append(screenContainer, tabContainer);

    return {
        navigation,
        screenContainer,
        tabContainer,
        screenHost,
        tabBar
    };
}

test("the integrated app renders its initial screen and tabs", () => {
    const app = createApp();

    assert.equal(app.screenContainer.textContent, "Home screen");

    assert.equal(app.tabContainer.querySelectorAll('[role="tab"]').length, 3);

    assert.equal(
        app.tabContainer
            .querySelector('[data-tab-id="home"]')
            .getAttribute("aria-selected"),
        "true"
    );

    app.tabBar.unmount();
    app.screenHost.unmount();
});

test("clicking a tab updates both the screen and selected tab", () => {
    const app = createApp();

    app.tabContainer.querySelector('[data-tab-id="search"]').click();

    assert.equal(app.screenContainer.textContent, "Search screen");

    assert.equal(app.navigation.selectedTabId, "search");

    assert.equal(
        app.tabContainer
            .querySelector('[data-tab-id="search"]')
            .getAttribute("aria-selected"),
        "true"
    );

    assert.equal(
        app.tabContainer
            .querySelector('[data-tab-id="home"]')
            .getAttribute("aria-selected"),
        "false"
    );

    app.tabBar.unmount();
    app.screenHost.unmount();
});

test("navigating within a tab preserves the tab bar", () => {
    const app = createApp();

    const originalTabBar = app.tabContainer.firstElementChild;

    app.navigation.navigate("Details");

    assert.equal(app.screenContainer.textContent, "Details screen");

    assert.equal(app.tabContainer.firstElementChild, originalTabBar);

    assert.equal(app.tabContainer.querySelectorAll('[role="tab"]').length, 3);

    app.tabBar.unmount();
    app.screenHost.unmount();
});

test("switching tabs and returning preserves the previous tab stack", () => {
    const app = createApp();

    app.navigation.navigate("Details");

    app.navigation.selectTab("search");

    assert.equal(app.screenContainer.textContent, "Search screen");

    app.navigation.selectTab("home");

    assert.equal(app.screenContainer.textContent, "Details screen");

    assert.equal(app.navigation.selectedTabId, "home");

    app.tabBar.unmount();
    app.screenHost.unmount();
});

test("back navigation updates the screen without removing tabs", () => {
    const app = createApp();

    app.navigation.navigate("Details");

    assert.equal(app.screenContainer.textContent, "Details screen");

    assert.equal(app.navigation.canGoBack(), true);

    app.navigation.back();

    assert.equal(app.screenContainer.textContent, "Home screen");

    assert.equal(app.tabContainer.querySelectorAll('[role="tab"]').length, 3);

    app.tabBar.unmount();
    app.screenHost.unmount();
});

test("programmatic tab changes keep the two containers synchronized", () => {
    const app = createApp();

    app.navigation.selectTab("settings");

    assert.equal(app.screenContainer.textContent, "Settings screen");

    assert.equal(
        app.tabContainer
            .querySelector('[data-tab-id="settings"]')
            .getAttribute("aria-selected"),
        "true"
    );

    app.tabBar.unmount();
    app.screenHost.unmount();
});
