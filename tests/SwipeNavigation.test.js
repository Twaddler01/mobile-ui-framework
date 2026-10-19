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
    global.PointerEvent = dom.window.PointerEvent;

    return dom;
}

function pointerEvent(dom, type, { x, y, id = 1 }) {
    if (typeof dom.window.PointerEvent === "function") {
        return new dom.window.PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: id,
            pointerType: "touch",
            isPrimary: true
        });
    }

    const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true
    });

    Object.defineProperties(event, {
        clientX: { value: x },
        clientY: { value: y },
        pointerId: { value: id },
        pointerType: { value: "touch" },
        isPrimary: { value: true }
    });

    return event;
}

async function makeNavigator(tabs) {
    const { default: ScreenRegistry } =
        await import("../src/navigation/ScreenRegistry.js");
    const { default: Screen } = await import("../src/navigation/Screen.js");
    const { default: TabNavigator } =
        await import("../src/navigation/TabNavigator.js");

    const stub = () => ({ type: "element", props: {}, children: ["x"] });

    const names = tabs.map(tab => tab.screen);
    const registry = new ScreenRegistry(
        Object.fromEntries(names.map(name => [name, Screen(stub)]))
    );

    return new TabNavigator(registry, tabs);
}

function dispatch(el, dom, type, opts) {
    el.dispatchEvent(pointerEvent(dom, type, opts));
}

async function mountSwipe(navigator, options = {}) {
    const { default: SwipeNavigation } =
        await import("../src/navigation/SwipeNavigation.js");

    const host = document.getElementById("host");
    const swipe = new SwipeNavigation(navigator, options).mount(host);

    return { swipe, host };
}

const THREE_TABS = [
    { id: "home", label: "Home", screen: "Home" },
    { id: "search", label: "Search", screen: "Search" },
    { id: "settings", label: "Settings", screen: "Settings" }
];

describe("SwipeNavigation", () => {
    test("requires a TabNavigator", async () => {
        setup();
        const { default: SwipeNavigation } =
            await import("../src/navigation/SwipeNavigation.js");

        assert.throws(() => new SwipeNavigation(null), /TabNavigator/);
        assert.throws(() => new SwipeNavigation({}), /TabNavigator/);
    });

    test("rejects unknown options", async () => {
        setup();
        const { default: SwipeNavigation } =
            await import("../src/navigation/SwipeNavigation.js");

        const nav = await makeNavigator(THREE_TABS);

        assert.throws(
            () => new SwipeNavigation(nav, { wat: true }),
            /Unknown SwipeNavigation option/
        );
    });

    test("mount/unmount lifecycle", async () => {
        setup();
        const nav = await makeNavigator(THREE_TABS);
        const { swipe, host } = await mountSwipe(nav);

        assert.equal(swipe.isMounted, true);
        assert.throws(() => swipe.mount(host), /already mounted/);

        swipe.unmount();
        assert.equal(swipe.isMounted, false);
    });

    test("swipe left on middle tab goes to next tab", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("search");
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 220, y: 400 });
        dispatch(document, dom, "pointerup", { x: 220, y: 400 });

        assert.equal(nav.selectedTabId, "settings");
    });

    test("swipe right on middle tab goes to previous tab", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("search");
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 100, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 180, y: 400 });
        dispatch(document, dom, "pointerup", { x: 180, y: 400 });

        assert.equal(nav.selectedTabId, "home");
    });

    test("no wrap by default — swipe left on last tab is a no-op", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("settings");
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 220, y: 400 });
        dispatch(document, dom, "pointerup", { x: 220, y: 400 });

        assert.equal(nav.selectedTabId, "settings");
    });

    test("wrap: true cycles from last to first", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("settings");
        const { swipe, host } = await mountSwipe(nav, { wrap: true });

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 220, y: 400 });
        dispatch(document, dom, "pointerup", { x: 220, y: 400 });

        assert.equal(nav.selectedTabId, "home");
    });

    test("short slow swipe does not fire", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("search");
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 2000;
        dispatch(host, dom, "pointermove", { x: 270, y: 400 });
        dispatch(document, dom, "pointerup", { x: 270, y: 400 });

        // 30px, 1000ms — fails both distance and velocity.
        assert.equal(nav.selectedTabId, "search");
    });

    test("fast short swipe fires via velocity", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("search");
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1050;
        dispatch(host, dom, "pointermove", { x: 260, y: 400 });
        dispatch(document, dom, "pointerup", { x: 260, y: 400 });

        // 40px / 50ms = 0.8 px/ms — passes velocity.
        assert.equal(nav.selectedTabId, "settings");
    });

    test("vertical swipe is abandoned", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("search");
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 305, y: 320 });
        dispatch(document, dom, "pointerup", { x: 305, y: 320 });

        assert.equal(nav.selectedTabId, "search");
    });

    test("no paging when stack depth > 1", async () => {
        const dom = setup();

        const { default: ScreenRegistry } =
            await import("../src/navigation/ScreenRegistry.js");
        const { default: Screen } = await import("../src/navigation/Screen.js");
        const { default: TabNavigator } =
            await import("../src/navigation/TabNavigator.js");

        const stub = () => ({
            type: "element",
            props: {},
            children: ["x"]
        });

        const registry = new ScreenRegistry({
            Home: Screen(stub),
            Details: Screen(stub),
            Search: Screen(stub)
        });

        const nav = new TabNavigator(registry, [
            { id: "home", label: "Home", screen: "Home" },
            { id: "search", label: "Search", screen: "Search" }
        ]);

        nav.navigate("Details");
        assert.equal(nav.stack.length, 2);

        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 220, y: 400 });
        dispatch(document, dom, "pointerup", { x: 220, y: 400 });

        assert.equal(nav.selectedTabId, "home");
        assert.equal(nav.stack.length, 2);
    });

    test("single tab — swipe is inert", async () => {
        const dom = setup();
        const nav = await makeNavigator([
            { id: "home", label: "Home", screen: "Home" }
        ]);
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 220, y: 400 });
        dispatch(document, dom, "pointerup", { x: 220, y: 400 });

        assert.equal(nav.selectedTabId, "home");
    });

    test("pointercancel aborts the gesture", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("search");
        const { swipe, host } = await mountSwipe(nav);

        let now = 1000;
        swipe._now = () => now;

        dispatch(host, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(host, dom, "pointermove", { x: 220, y: 400 });
        dispatch(document, dom, "pointercancel", {
            x: 220,
            y: 400
        });
        dispatch(document, dom, "pointerup", { x: 220, y: 400 });

        assert.equal(nav.selectedTabId, "search");
    });

    test("ignoreSelector skips gestures inside matching elements", async () => {
        const dom = setup();
        const nav = await makeNavigator(THREE_TABS);
        nav.selectTab("search");

        const host = document.getElementById("host");
        const carousel = document.createElement("div");
        carousel.className = "carousel";
        host.appendChild(carousel);

        const { swipe } = await mountSwipe(nav, {
            ignoreSelector: ".carousel"
        });

        let now = 1000;
        swipe._now = () => now;

        dispatch(carousel, dom, "pointerdown", { x: 300, y: 400 });
        now = 1100;
        dispatch(carousel, dom, "pointermove", { x: 220, y: 400 });
        dispatch(document, dom, "pointerup", { x: 220, y: 400 });

        assert.equal(nav.selectedTabId, "search");
    });
});
