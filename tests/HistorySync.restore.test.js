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
        Deep: Screen(stub),
        Search: Screen(stub)
    });

    return new TabNavigator(registry, [
        { id: "home", label: "Home", screen: "Home" },
        { id: "search", label: "Search", screen: "Search" }
    ]);
}

function dispatchPop(state) {
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

function runRestoreSuite(mode, initialUrl) {
    const tag = `[${mode}]`;

    describe(`HistorySync restore ${tag}`, () => {
        test(`${tag} popstate with state restores the stack`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            nav.navigate("Details", { itemId: 42 });
            assert.equal(nav.current.screen.name, "Details");

            dispatchPop({
                version: 1,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            assert.equal(nav.current.screen.name, "Home");

            sync.stop();
        });

        test(`${tag} popstate does not push new history entries`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");

            const before = history.length;
            let pushes = 0;
            const origPush = history.pushState.bind(history);
            const origReplace = history.replaceState.bind(history);

            history.pushState = (...args) => {
                pushes++;
                return origPush(...args);
            };
            history.replaceState = (...args) => origReplace(...args);

            dispatchPop({
                version: 1,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            history.pushState = origPush;
            history.replaceState = origReplace;

            assert.equal(pushes, 0, "popstate restore must not re-push");
            assert.equal(history.length, before);

            sync.stop();
        });

        test(`${tag} popstate with null state falls back to URL parsing`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            // Simulate arriving at a URL with no state (fresh paste / cleared).
            history.replaceState(
                null,
                "",
                mode === "hash"
                    ? "#/home/details?itemId=42"
                    : "/home/details?itemId=42"
            );

            dispatchPop(null);

            assert.equal(nav.current.screen.name, "Details");
            assert.equal(nav.current.screen.params.itemId, "42");

            sync.stop();
        });

        test(`${tag} start() restores from history.state`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            history.replaceState(
                {
                    version: 1,
                    tabId: "home",
                    stack: [
                        { name: "Home", params: {} },
                        { name: "Details", params: { itemId: "42" } }
                    ]
                },
                "",
                mode === "hash"
                    ? "#/home/details?itemId=42"
                    : "/home/details?itemId=42"
            );

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            assert.equal(nav.current.screen.name, "Details");
            assert.equal(nav.current.screen.params.itemId, "42");

            sync.stop();
        });

        test(`${tag} start() restores from URL when state is absent`, async () => {
            const url =
                mode === "hash"
                    ? "http://localhost/app/index.html#/home/details?itemId=42"
                    : "http://localhost/home/details?itemId=42";
            setup(url);

            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            // Force history.state to null to simulate a fresh paste.
            history.replaceState(null, "", url);

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            assert.equal(nav.current.screen.name, "Details");
            assert.equal(nav.current.screen.params.itemId, "42");

            // start() should have attached proper state for next refresh.
            assert.equal(history.state?.version, 1);
            assert.equal(history.state.tabId, "home");

            sync.stop();
        });

        test(`${tag} cross-tab restore switches to the target tab`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            nav.selectTab("search");
            assert.equal(nav.selectedTabId, "search");

            dispatchPop({
                version: 1,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            assert.equal(nav.selectedTabId, "home");
            assert.equal(nav.current.screen.name, "Home");

            sync.stop();
        });

        test(`${tag} same-tab restore rebuilds an intermediate stack`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            nav.navigate("Details");
            nav.navigate("Deep", { depth: 2 });
            assert.equal(nav.current.screen.name, "Deep");

            dispatchPop({
                version: 1,
                tabId: "home",
                stack: [
                    { name: "Home", params: {} },
                    { name: "Details", params: {} }
                ]
            });

            assert.equal(nav.current.screen.name, "Details");
            assert.equal(nav.stack.length, 2);

            sync.stop();
        });

        test(`${tag} invalid state falls through to URL parse`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            history.replaceState(
                null,
                "",
                mode === "hash" ? "#/search" : "/search"
            );

            dispatchPop({ version: 999, tabId: "home", stack: [] });

            assert.equal(nav.selectedTabId, "search");
            assert.equal(nav.current.screen.name, "Search");

            sync.stop();
        });

        test(`${tag} unparseable URL leaves navigator untouched`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            const beforeTab = nav.selectedTabId;
            const beforeScreen = nav.current.screen.name;

            history.replaceState(
                null,
                "",
                mode === "hash" ? "#/unknown/thing" : "/unknown/thing"
            );

            dispatchPop(null);

            assert.equal(nav.selectedTabId, beforeTab);
            assert.equal(nav.current.screen.name, beforeScreen);

            sync.stop();
        });

        test(`${tag} stop() unbinds popstate`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details");
            sync.stop();

            dispatchPop({
                version: 1,
                tabId: "home",
                stack: [{ name: "Home", params: {} }]
            });

            // Still on Details because the listener was removed.
            assert.equal(nav.current.screen.name, "Details");
        });
    });
}

runRestoreSuite("hash", "http://localhost/app/index.html");
runRestoreSuite("history", "http://localhost/");
