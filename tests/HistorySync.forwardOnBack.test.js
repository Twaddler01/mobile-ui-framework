import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function setup(url) {
    const dom = new JSDOM(
        "<!doctype html><html><body><div id='host'></div></body></html>",
        { url }
    );
    global.window = dom.window;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.history = dom.window.history;
    global.location = dom.window.location;
    global.URLSearchParams = dom.window.URLSearchParams;
    global.PopStateEvent = dom.window.PopStateEvent;
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
        Deep: Screen(stub),
        Search: Screen(stub)
    });

    return new TabNavigator(registry, [
        { id: "home", label: "Home", screen: "Home" },
        { id: "search", label: "Search", screen: "Search" }
    ]);
}

function spyHistory() {
    const calls = { back: 0, forward: 0, push: 0, replace: 0 };
    const restore = {
        back: history.back.bind(history),
        forward: history.forward.bind(history),
        push: history.pushState.bind(history),
        replace: history.replaceState.bind(history)
    };
    history.back = () => {
        calls.back++;
    };
    history.forward = () => {
        calls.forward++;
    };
    history.pushState = (...a) => {
        calls.push++;
        restore.push(...a);
    };
    history.replaceState = (...a) => {
        calls.replace++;
        restore.replace(...a);
    };
    return {
        calls,
        restore() {
            history.back = restore.back;
            history.forward = restore.forward;
            history.pushState = restore.push;
            history.replaceState = restore.replace;
        }
    };
}

function dispatchPop(state) {
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

function runSuite(mode, initialUrl) {
    const tag = `[${mode}]`;

    describe(`Forward after browser-back ${tag}`, () => {
        test(`${tag} browser-back populates forward stack`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            assert.equal(nav.canGoForward(), false);

            dispatchPop({
                version: 1,
                _pointer: 0,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            assert.equal(nav.current.screen.name, "Home");
            assert.equal(nav.canGoForward(), true, "forward populated");
            assert.equal(nav.forwardStack.length, 1);
            assert.equal(nav.forwardStack[0].name, "Details");

            sync.stop();
        });

        test(`${tag} browser-back from depth 2 to depth 0 stacks both entries`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            nav.navigate("Deep");

            dispatchPop({
                version: 1,
                _pointer: 0,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            assert.equal(nav.current.screen.name, "Home");
            assert.equal(nav.canGoForward(), true);
            assert.equal(nav.forwardStack.length, 2);
            // LIFO: end of array is next forward target.
            assert.equal(nav.forwardStack[0].name, "Deep");
            assert.equal(nav.forwardStack[1].name, "Details");

            sync.stop();
        });

        test(`${tag} app-forward after browser-back uses history.forward()`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");

            dispatchPop({
                version: 1,
                _pointer: 0,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            const spy = spyHistory();
            nav.forward();

            assert.equal(spy.calls.forward, 1, "uses browser forward");
            assert.equal(spy.calls.replace, 0, "no replaceState fallback");

            spy.restore();
            sync.stop();
        });

        test(`${tag} browser-forward shrinks forward stack`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            nav.navigate("Deep");

            // Back to Details
            dispatchPop({
                version: 1,
                _pointer: 1,
                tabId: "home",
                stack: [
                    { name: "Home", params: {} },
                    { name: "Details", params: {} }
                ]
            });

            assert.equal(nav.current.screen.name, "Details");
            assert.equal(nav.forwardStack.length, 1);
            assert.equal(nav.forwardStack[0].name, "Deep");

            // Forward to Deep
            dispatchPop({
                version: 1,
                _pointer: 2,
                tabId: "home",
                stack: [
                    { name: "Home", params: {} },
                    { name: "Details", params: {} },
                    { name: "Deep", params: {} }
                ]
            });

            assert.equal(nav.current.screen.name, "Deep");
            assert.equal(nav.canGoForward(), false);

            sync.stop();
        });

        test(`${tag} browser-back then navigate clears forward again`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");

            dispatchPop({
                version: 1,
                _pointer: 0,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });
            assert.equal(nav.canGoForward(), true);

            nav.navigate("Search");
            assert.equal(nav.canGoForward(), false);

            sync.stop();
        });

        test(`${tag} Attributes flip on browser-back`, async () => {
            setup(initialUrl);

            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");
            const { default: ScreenHost } =
                await import("../src/navigation/ScreenHost.js");

            const nav = await makeNavigator();
            const host = document.getElementById("host"); // ← from setup()'s body

            const screenHost = new ScreenHost(nav, { transition: false });
            screenHost.mount(host);

            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");

            assert.equal(host.dataset.canGoBack, "true");
            assert.equal(host.dataset.canGoForward, "false");

            dispatchPop({
                version: 1,
                _pointer: 0,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            assert.equal(host.dataset.canGoBack, "false");
            assert.equal(host.dataset.canGoForward, "true");

            sync.stop();
        });
    });
}

runSuite("hash", "http://localhost/app/index.html");
runSuite("history", "http://localhost/");
