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
        calls.back++;
    };
    history.forward = () => {
        calls.forward++;
    };
    history.pushState = (...args) => {
        calls.push++;
        restore.push(...args);
    };
    history.replaceState = (...args) => {
        calls.replace++;
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

function runForwardSuite(mode, initialUrl) {
    const tag = `[${mode}]`;

    describe(`HistorySync forward ${tag}`, () => {
        test(`${tag} app-forward after app-back calls history.forward()`, async () => {
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

            // Simulate the popstate from that history.back().
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

            nav.forward();
            assert.equal(spy.calls.forward, 1);
            assert.equal(spy.calls.push, 0);
            assert.equal(spy.calls.replace, 0);

            spy.restore();
            sync.stop();
        });

        test(`${tag} fresh-paste back-then-forward uses replaceState`, async () => {
            const url =
                mode === "hash"
                    ? "http://localhost/app/index.html#/home/details"
                    : "http://localhost/home/details";
            setup(url);

            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            // Fresh paste — no app state in history.
            history.replaceState(null, "", url);

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            assert.equal(nav.current.screen.name, "Details");
            assert.equal(sync._historyPointer, 0);

            // App-back on a fresh paste has no browser entry to pop.
            nav.back();
            assert.equal(nav.canGoForward(), true, "forward stack populated");
            assert.equal(sync._historyPointer, 0);

            // App-forward: the browser still has no forward entry
            // (we never called history.back()), so we synthesize via replace.
            const spy = spyHistory();
            nav.forward();

            assert.equal(
                spy.calls.forward,
                0,
                "no browser forward entry exists"
            );
            assert.equal(spy.calls.replace, 1, "synthesize via replaceState");

            spy.restore();
            sync.stop();
        });

        test(`${tag} _pendingPop skips forward's resulting popstate`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            nav.back();

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

            const spy = spyHistory();
            nav.forward();
            assert.equal(spy.calls.forward, 1);

            // Fire the popstate the browser will have queued.
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

            // App is still on Details (already there via forward()).
            assert.equal(nav.current.screen.name, "Details");
            assert.equal(sync._pendingPop, false);

            spy.restore();
            sync.stop();
        });

        test(`${tag} _pointer increments on forward`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            nav.navigate("Details");
            assert.equal(sync._historyPointer, 1);

            nav.back();
            assert.equal(sync._historyPointer, 0);

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

            nav.forward();
            assert.equal(sync._historyPointer, 1);

            sync.stop();
        });

        test(`${tag} back-then-navigate clears forward and pointer resets`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            nav.back();
            assert.equal(nav.canGoForward(), true);

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

            nav.navigate("Search");
            assert.equal(nav.canGoForward(), false);
            assert.equal(sync._historyPointer, 1);

            sync.stop();
        });
    });
}

runForwardSuite("hash", "http://localhost/app/index.html");
runForwardSuite("history", "http://localhost/");
