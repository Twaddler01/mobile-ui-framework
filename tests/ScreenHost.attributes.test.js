import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function setup() {
    const dom = new JSDOM(
        "<!doctype html><html><body><div id='host'></div></body></html>",
        { url: "http://localhost/" }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.requestAnimationFrame = fn => setTimeout(fn, 0);

    return dom;
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
        Search: Screen(stub)
    });

    return new TabNavigator(registry, [
        { id: "home", label: "Home", screen: "Home" },
        { id: "search", label: "Search", screen: "Search" }
    ]);
}

async function mountHost(nav) {
    const { default: ScreenHost } =
        await import("../src/navigation/ScreenHost.js");

    const host = document.getElementById("host");
    const screenHost = new ScreenHost(nav, { transition: false });
    screenHost.mount(host);

    return { screenHost, host };
}

describe("ScreenHost navigation attributes", () => {
    test("initial mount sets both attributes to false at root", async () => {
        setup();
        const nav = await makeNavigator();
        const { host } = await mountHost(nav);

        assert.equal(host.dataset.canGoBack, "false");
        assert.equal(host.dataset.canGoForward, "false");
    });

    test("navigate sets canGoBack to true", async () => {
        setup();
        const nav = await makeNavigator();
        const { host } = await mountHost(nav);

        nav.navigate("Details");

        assert.equal(host.dataset.canGoBack, "true");
        assert.equal(host.dataset.canGoForward, "false");
    });

    test("back sets canGoForward to true and canGoBack to false", async () => {
        setup();
        const nav = await makeNavigator();
        const { host } = await mountHost(nav);
        nav.navigate("Details");

        nav.back();

        assert.equal(host.dataset.canGoBack, "false");
        assert.equal(host.dataset.canGoForward, "true");
    });

    test("forward flips both back", async () => {
        setup();
        const nav = await makeNavigator();
        const { host } = await mountHost(nav);
        nav.navigate("Details");
        nav.back();

        nav.forward();

        assert.equal(host.dataset.canGoBack, "true");
        assert.equal(host.dataset.canGoForward, "false");
    });

    test("selectTab clears forward stack attributes", async () => {
        setup();
        const nav = await makeNavigator();
        const { host } = await mountHost(nav);
        nav.navigate("Details");
        nav.back();
        assert.equal(host.dataset.canGoForward, "true");

        nav.selectTab("search");

        assert.equal(host.dataset.canGoBack, "false");
        assert.equal(host.dataset.canGoForward, "false");
    });

    test("returning to a tab preserves its attributes", async () => {
        setup();
        const nav = await makeNavigator();
        const { host } = await mountHost(nav);
        nav.navigate("Details");
        nav.back();

        nav.selectTab("search");
        assert.equal(host.dataset.canGoForward, "false");

        nav.selectTab("home");
        assert.equal(host.dataset.canGoForward, "true");
    });

    test("navigate clears forward stack attributes", async () => {
        setup();
        const nav = await makeNavigator();
        const { host } = await mountHost(nav);
        nav.navigate("Details");
        nav.back();
        assert.equal(host.dataset.canGoForward, "true");

        nav.navigate("Search");

        assert.equal(host.dataset.canGoForward, "false");
        assert.equal(host.dataset.canGoBack, "true");
    });

    test("unmount clears attributes", async () => {
        setup();
        const nav = await makeNavigator();
        const { screenHost, host } = await mountHost(nav);
        nav.navigate("Details");
        assert.equal(host.dataset.canGoBack, "true");

        screenHost.unmount();

        assert.equal(host.dataset.canGoBack, undefined);
        assert.equal(host.dataset.canGoForward, undefined);
    });

    test("missing canGoBack/canGoForward methods default to false", async () => {
        setup();

        // Deliberately minimal navigation stub — no canGoBack/canGoForward.
        const stubNavigation = {
            current: {
                screen: {
                    id: 1,
                    name: "Home",
                    output: {
                        type: "element",
                        props: {},
                        children: ["x"]
                    }
                }
            },
            on() {},
            off() {}
        };

        const { default: ScreenHost } =
            await import("../src/navigation/ScreenHost.js");

        const host = document.getElementById("host");
        new ScreenHost(stubNavigation, { transition: false }).mount(host);

        assert.equal(host.dataset.canGoBack, "false");
        assert.equal(host.dataset.canGoForward, "false");
    });
});
