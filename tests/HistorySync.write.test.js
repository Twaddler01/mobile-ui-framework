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

function routeFor(mode) {
    return mode === "hash"
        ? location.hash.slice(1)
        : location.pathname + location.search;
}

function runWriteSuite(mode, initialUrl) {
    const tag = `[${mode}]`;

    describe(`HistorySync ${tag}`, () => {
        test(`${tag} start() writes /home`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            assert.equal(routeFor(mode), "/home");

            sync.stop();
        });

        test(`${tag} start() uses replaceState`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const before = history.length;

            const sync = new HistorySync(nav, { mode });
            sync.start();

            assert.equal(history.length, before);

            sync.stop();
        });

        test(`${tag} navigate() pushes /home/details`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            const before = history.length;
            nav.navigate("Details");

            assert.equal(history.length, before + 1);
            assert.equal(routeFor(mode), "/home/details");

            sync.stop();
        });

        test(`${tag} back() restores the previous URL`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            nav.navigate("Details");
            nav.back();

            assert.equal(routeFor(mode), "/home");

            sync.stop();
        });

        test(`${tag} selectTab() replaces, does not push`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            const before = history.length;
            nav.selectTab("search");

            assert.equal(history.length, before);
            assert.equal(routeFor(mode), "/search");

            sync.stop();
        });

        test(`${tag} params round-trip into the query string`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            nav.navigate("Details", { itemId: 42, filter: "all" });

            const route = routeFor(mode);
            const queryPart = route.split("?")[1] ?? "";
            const params = new URLSearchParams(queryPart);

            assert.equal(params.get("itemId"), "42");
            assert.equal(params.get("filter"), "all");

            sync.stop();
        });

        test(`${tag} history.state carries the full stack`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            nav.navigate("Details", { itemId: 42 });

            assert.deepEqual(history.state, {
                version: 1,
                _pointer: 1,
                tabId: "home",
                stack: [
                    { name: "Home", params: {} },
                    { name: "Details", params: { itemId: 42 } }
                ]
            });

            sync.stop();
        });

        test(`${tag} stop() detaches; further navigation is silent`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();

            const routeAfterStart = routeFor(mode);
            sync.stop();

            nav.navigate("Details");
            assert.equal(routeFor(mode), routeAfterStart);
        });

        test(`${tag} start() is idempotent`, async () => {
            setup(initialUrl);
            const { default: HistorySync } =
                await import("../src/navigation/HistorySync.js");

            const nav = await makeNavigator();
            const sync = new HistorySync(nav, { mode });
            sync.start();
            const before = history.length;
            sync.start();

            assert.equal(history.length, before);
            assert.equal(sync.isStarted, true);

            sync.stop();
        });
    });
}

runWriteSuite("hash", "http://localhost/app/index.html");
runWriteSuite("history", "http://localhost/");
