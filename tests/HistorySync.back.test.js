import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function setup(url) {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url
    });

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

    const stub = () => ({ type: "element", props: {}, children: ["stub"] });

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

function spyHistory() {
    const calls = { back: 0, forward: 0, push: 0, replace: 0 };
    const restore = {
        back: history.back.bind(history),
        forward: history.forward.bind(history),
        push: history.pushState.bind(history),
        replace: history.replaceState.bind(history)
    };

    history.back = () => {
        calls.back += 1;
    };
    history.forward = () => {
        calls.forward += 1;
    };
    history.pushState = (...args) => {
        calls.push += 1;
        restore.push(...args);
    };
    history.replaceState = (...args) => {
        calls.replace += 1;
        restore.replace(...args);
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

function runBackSuite(mode, initialUrl) {
    const tag = `[${mode}]`;

    describe(`HistorySync back ${tag}`, () => {
        test(`${tag} app-back calls history.back(), not pushState`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            nav.navigate("Details");

            const spy = spyHistory();
            nav.back();

            assert.equal(spy.calls.back, 1);
            assert.equal(spy.calls.push, 0);
            assert.equal(spy.calls.replace, 0);

            spy.restore();
            sync.stop();
        });

        test(`${tag} _pendingPop skips the resulting popstate`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");

            const spy = spyHistory();
            nav.back();
            assert.equal(spy.calls.back, 1);
            spy.restore();

            // Manually fire the popstate the browser would have fired.
            // Since _pendingPop is true, no restore should occur — the
            // app is already on Home (the stack was popped by nav.back()).
            assert.equal(nav.current.screen.name, "Home");

            window.dispatchEvent(
                new PopStateEvent("popstate", {
                    state: {
                        version: 1,
                        _pointer: 0,
                        tabId: "home",
                        stack: [{ name: "Home", params: {} }]
                    }
                })
            );

            assert.equal(nav.current.screen.name, "Home");
            assert.equal(sync._pendingPop, false);

            sync.stop();
        });

        test(`${tag} _pendingPop prevents duplicate history writes`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");

            const spy = spyHistory();
            nav.back();

            const pushesAfterBack = spy.calls.push;
            const replacesAfterBack = spy.calls.replace;

            // Simulate the browser's popstate arriving.
            window.dispatchEvent(
                new PopStateEvent("popstate", {
                    state: {
                        version: 1,
                        _pointer: 0,
                        tabId: "home",
                        stack: [{ name: "Home", params: {} }]
                    }
                })
            );

            // No new push/replace should have fired from the popstate.
            assert.equal(spy.calls.push, pushesAfterBack);
            assert.equal(spy.calls.replace, replacesAfterBack);

            spy.restore();
            sync.stop();
        });

        test(`${tag} fresh deep paste uses replaceState on app-back`, async () => {
            const url =
                mode === "hash"
                    ? "http://localhost/app/index.html#/home/details"
                    : "http://localhost/home/details";
            setup(url);

            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            // No history.state — simulates fresh paste.
            history.replaceState(null, "", url);

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            assert.equal(nav.current.screen.name, "Details");
            assert.equal(sync._historyPointer, 0);

            const spy = spyHistory();
            nav.back();

            assert.equal(spy.calls.back, 0, "must not leave the app");
            assert.equal(spy.calls.replace, 1);

            spy.restore();
            sync.stop();
        });

        test(`${tag} pointer increments on navigate, decrements on back`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            assert.equal(sync._historyPointer, 0);

            nav.navigate("Details");
            assert.equal(sync._historyPointer, 1);

            nav.back();
            assert.equal(sync._historyPointer, 0);

            sync.stop();
        });

        test(`${tag} pointer is stored in state and survives reload`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav1 = await makeNavigator();
            const sync1 = new HistorySync(nav1, { mode });
            sync1.start();
            nav1.navigate("Details");
            nav1.navigate("Search");
            // Pointer should now be 2.

            const savedState = history.state;

            // Simulate reload: fresh navigator, same URL.
            const nav2 = await makeNavigator();
            const sync2 = new HistorySync(nav2, { mode });
            sync2.start();

            assert.equal(sync2._historyPointer, savedState._pointer);
            assert.equal(sync2._historyPointer, 2);

            sync1.stop();
            sync2.stop();
        });

        test(`${tag} external popstate syncs pointer from state`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            nav.navigate("Search");
            assert.equal(sync._historyPointer, 2);

            // Browser-initiated back: popstate with state._pointer = 1.
            window.dispatchEvent(
                new PopStateEvent("popstate", {
                    state: {
                        version: 1,
                        _pointer: 1,
                        tabId: "home",
                        stack: [
                            { name: "Home", params: {} },
                            { name: "Details", params: {} }
                        ]
                    }
                })
            );

            assert.equal(sync._historyPointer, 1);
            assert.equal(nav.current.screen.name, "Details");

            sync.stop();
        });

        test(`${tag} external popstate with null state resets pointer to 0`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            nav.navigate("Search");
            assert.equal(sync._historyPointer, 2);

            window.dispatchEvent(
                new PopStateEvent("popstate", { state: null })
            );

            assert.equal(sync._historyPointer, 0);

            sync.stop();
        });

        test(`${tag} stale _pendingPop falls back to replaceState`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            nav.navigate("Search");

            // Force a stuck _pendingPop (as if a prior history.back()
            // silently failed to fire popstate).
            sync._pendingPop = true;

            const spy = spyHistory();
            nav.back();

            assert.equal(spy.calls.back, 0);
            assert.equal(spy.calls.replace, 1);
            assert.equal(sync._pendingPop, false);

            spy.restore();
            sync.stop();
        });

        test(`${tag} selectTab still uses replaceState`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            const spy = spyHistory();
            nav.selectTab("search");

            assert.equal(spy.calls.replace, 1);
            assert.equal(spy.calls.push, 0);
            assert.equal(spy.calls.back, 0);

            spy.restore();
            sync.stop();
        });
    });
}

runBackSuite("hash", "http://localhost/app/index.html");
runBackSuite("history", "http://localhost/");
