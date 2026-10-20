import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function setup() {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost/"
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.Element = dom.window.Element;

    return dom;
}

async function makeManager() {
    const { default: ScreenRegistry } =
        await import("../src/navigation/ScreenRegistry.js");
    const { default: Screen } = await import("../src/navigation/Screen.js");
    const { default: ScreenManager } =
        await import("../src/navigation/ScreenManager.js");

    const stub = () => ({ type: "element", props: {}, children: ["s"] });

    const registry = new ScreenRegistry({
        Home: Screen(stub),
        Details: Screen(stub),
        Deep: Screen(stub)
    });

    const manager = new ScreenManager(registry);
    manager.navigate("Home");

    return manager;
}

async function makeNavigator() {
    const { default: ScreenRegistry } =
        await import("../src/navigation/ScreenRegistry.js");
    const { default: Screen } = await import("../src/navigation/Screen.js");
    const { default: TabNavigator } =
        await import("../src/navigation/TabNavigator.js");

    const stub = () => ({ type: "element", props: {}, children: ["s"] });

    const registry = new ScreenRegistry({
        Home: Screen(stub),
        Details: Screen(stub),
        Deep: Screen(stub),
        Search: Screen(stub)
    });

    return new TabNavigator(registry, [
        { id: "home", label: "Home", screen: "Home" },
        { id: "search", label: "Search", screen: "Search" }
    ]);
}

describe("ScreenManager forward()", () => {
    test("canGoForward() is false initially", async () => {
        setup();
        const manager = await makeManager();
        assert.equal(manager.canGoForward(), false);
    });

    test("back() populates forward stack", async () => {
        setup();
        const manager = await makeManager();
        manager.navigate("Details");
        manager.back();

        assert.equal(manager.canGoForward(), true);
        assert.equal(manager.forwardStack.length, 1);
        assert.equal(manager.forwardStack[0].name, "Details");
    });

    test("forward() restores the popped screen", async () => {
        setup();
        const manager = await makeManager();
        manager.navigate("Details");
        manager.back();

        const result = manager.forward();
        assert.equal(result.name, "Details");
        assert.equal(manager.current.name, "Details");
        assert.equal(manager.canGoForward(), false);
    });

    test("forward() on empty stack returns false", async () => {
        setup();
        const manager = await makeManager();
        assert.equal(manager.forward(), false);
    });

    test("navigate() clears forward stack", async () => {
        setup();
        const manager = await makeManager();
        manager.navigate("Details");
        manager.back();
        assert.equal(manager.canGoForward(), true);

        manager.navigate("Deep");
        assert.equal(manager.canGoForward(), false);
    });

    test("replace() clears forward stack", async () => {
        setup();
        const manager = await makeManager();
        manager.navigate("Details");
        manager.back();
        manager.replace("Deep");

        assert.equal(manager.canGoForward(), false);
    });

    test("reset() clears forward stack", async () => {
        setup();
        const manager = await makeManager();
        manager.navigate("Details");
        manager.back();
        manager.reset("Home");

        assert.equal(manager.canGoForward(), false);
    });

    test("back() with no prior stack does not populate forward", async () => {
        setup();
        const manager = await makeManager();
        assert.equal(manager.back(), false);
        assert.equal(manager.canGoForward(), false);
    });

    test("interleaved back/forward roundtrips", async () => {
        setup();
        const manager = await makeManager();
        manager.navigate("Details");
        manager.navigate("Deep");

        manager.back();
        manager.back();
        assert.equal(manager.current.name, "Home");
        assert.equal(manager.forwardStack.length, 2);

        manager.forward();
        assert.equal(manager.current.name, "Details");
        assert.equal(manager.forwardStack.length, 1);

        manager.forward();
        assert.equal(manager.current.name, "Deep");
        assert.equal(manager.forwardStack.length, 0);
    });
});

describe("TabNavigator forward()", () => {
    test("passes through to active tab's manager", async () => {
        setup();
        const nav = await makeNavigator();
        nav.navigate("Details");
        nav.back();

        assert.equal(nav.canGoForward(), true);

        nav.forward();
        assert.equal(nav.current.screen.name, "Details");
        assert.equal(nav.canGoForward(), false);
    });

    test("change event carries canGoBack / canGoForward", async () => {
        setup();
        const nav = await makeNavigator();

        let lastEvent = null;
        nav.on("change", event => {
            lastEvent = event;
        });

        nav.navigate("Details");
        assert.equal(lastEvent.canGoBack, true);
        assert.equal(lastEvent.canGoForward, false);

        nav.back();
        assert.equal(lastEvent.canGoBack, false);
        assert.equal(lastEvent.canGoForward, true);
    });

    test("forward is per-tab", async () => {
        setup();
        const nav = await makeNavigator();

        nav.navigate("Details");
        nav.back();

        nav.selectTab("search");
        assert.equal(nav.canGoForward(), false);

        nav.selectTab("home");
        assert.equal(nav.canGoForward(), true);
    });
});
