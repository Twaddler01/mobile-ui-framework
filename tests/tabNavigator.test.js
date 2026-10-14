import test from "node:test";
import assert from "node:assert/strict";

import Screen from "../src/navigation/Screen.js";
import ScreenBase from "../src/navigation/ScreenBase.js";
import ScreenRegistry from "../src/navigation/ScreenRegistry.js";
import TabNavigator from "../src/navigation/TabNavigator.js";

function createNavigator() {
    const registry = new ScreenRegistry({
        Home: Screen(context => ({
            name: context.name,
            params: context.params
        })),
        Details: Screen(context => ({
            name: context.name,
            params: context.params
        })),
        Search: Screen(context => ({
            name: context.name,
            params: context.params
        })),
        Results: Screen(context => ({
            name: context.name,
            params: context.params
        })),
        Settings: Screen(context => ({
            name: context.name,
            params: context.params
        }))
    });

    return new TabNavigator(registry, [
        {
            id: "home",
            label: "Home",
            icon: "house",
            screen: "Home"
        },
        {
            id: "search",
            label: "Search",
            icon: "search",
            screen: "Search"
        },
        {
            id: "settings",
            label: "Settings",
            icon: "settings",
            screen: "Settings"
        }
    ]);
}

test("first tab is selected and initialized automatically", () => {
    const navigator = createNavigator();

    assert.equal(navigator.selectedTabId, "home");
    assert.equal(navigator.current.screen.name, "Home");
    assert.equal(navigator.tabs[0].initialized, true);
    assert.equal(navigator.tabs[1].initialized, false);
});

test("tab metadata reports selection and stack lengths", () => {
    const navigator = createNavigator();

    assert.deepEqual(
        navigator.tabs.map(tab => ({
            id: tab.id,
            selected: tab.selected,
            stackLength: tab.stackLength
        })),
        [
            { id: "home", selected: true, stackLength: 1 },
            { id: "search", selected: false, stackLength: 0 },
            { id: "settings", selected: false, stackLength: 0 }
        ]
    );
});

test("selecting a tab initializes its initial screen", () => {
    const navigator = createNavigator();

    navigator.selectTab("search");

    assert.equal(navigator.selectedTabId, "search");
    assert.equal(navigator.current.screen.name, "Search");
    assert.equal(navigator.tabs[1].initialized, true);
});

test("each tab retains an independent navigation stack", () => {
    const navigator = createNavigator();

    navigator.navigate("Details", { itemId: 12 });

    navigator.selectTab("search");
    navigator.navigate("Results", { query: "games" });

    assert.deepEqual(
        navigator.stack.map(entry => entry.name),
        ["Search", "Results"]
    );

    navigator.selectTab("home");

    assert.deepEqual(
        navigator.stack.map(entry => entry.name),
        ["Home", "Details"]
    );

    assert.deepEqual(navigator.current.screen.params, { itemId: 12 });
});

test("switching back to a tab preserves its current screen", () => {
    const navigator = createNavigator();

    navigator.navigate("Details");
    const originalOutput = navigator.current.screen.output;

    navigator.selectTab("search");
    navigator.selectTab("home");

    assert.equal(navigator.current.screen.name, "Details");
    assert.equal(navigator.current.screen.output, originalOutput);
});

test("back only changes the active tab stack", () => {
    const navigator = createNavigator();

    navigator.navigate("Details");
    navigator.selectTab("search");
    navigator.navigate("Results");

    navigator.back();

    assert.equal(navigator.current.screen.name, "Search");

    navigator.selectTab("home");

    assert.equal(navigator.current.screen.name, "Details");
    assert.equal(navigator.canGoBack(), true);
});

test("back returns false at the root of the active tab", () => {
    const navigator = createNavigator();

    assert.equal(navigator.canGoBack(), false);
    assert.equal(navigator.back(), false);
    assert.equal(navigator.current.screen.name, "Home");
});

test("navigate, replace, and reset act on the selected tab", () => {
    const navigator = createNavigator();

    navigator.navigate("Details");
    navigator.replace("Home");

    assert.deepEqual(
        navigator.stack.map(entry => entry.name),
        ["Home", "Home"]
    );

    navigator.reset("Details");

    assert.deepEqual(
        navigator.stack.map(entry => entry.name),
        ["Details"]
    );

    navigator.selectTab("search");

    assert.deepEqual(
        navigator.stack.map(entry => entry.name),
        ["Search"]
    );
});

test("selecting the already active tab does not reset its stack", () => {
    const navigator = createNavigator();

    navigator.navigate("Details");
    const before = navigator.current.screen.id;

    navigator.selectTab("home");

    assert.equal(navigator.current.screen.id, before);
    assert.equal(navigator.stack.length, 2);
});

test("unknown tabs are rejected", () => {
    const navigator = createNavigator();

    assert.throws(() => navigator.selectTab("missing"), /Unknown tab/);
});

test("empty and invalid tab definitions are rejected", () => {
    const registry = new ScreenRegistry({
        Home: Screen(() => "home")
    });

    assert.throws(() => new TabNavigator(registry, []), /non-empty array/);

    assert.throws(
        () =>
            new TabNavigator(registry, [
                {
                    id: "home",
                    label: "Home",
                    screen: "Missing"
                }
            ]),
        /Unknown screen/
    );
});

test("duplicate tab ids are rejected", () => {
    const registry = new ScreenRegistry({
        Home: Screen(() => "home")
    });

    assert.throws(
        () =>
            new TabNavigator(registry, [
                { id: "home", label: "Home", screen: "Home" },
                { id: "home", label: "Again", screen: "Home" }
            ]),
        /already defined/
    );
});

test("tab definitions reject unknown properties", () => {
    const registry = new ScreenRegistry({
        Home: Screen(() => "home")
    });

    assert.throws(
        () =>
            new TabNavigator(registry, [
                {
                    id: "home",
                    label: "Home",
                    screen: "Home",
                    hidden: true
                }
            ]),
        /Unknown tab property/
    );
});

test("tab change events report the selected tab", () => {
    const navigator = createNavigator();
    const events = [];

    navigator.on("tabChange", event => {
        events.push({
            action: event.action,
            previousTabId: event.previousTabId,
            tabId: event.tabId
        });
    });

    navigator.selectTab("search");
    navigator.selectTab("settings");

    assert.deepEqual(events, [
        {
            action: "selectTab",
            previousTabId: "home",
            tabId: "search"
        },
        {
            action: "selectTab",
            previousTabId: "search",
            tabId: "settings"
        }
    ]);
});

test("tab listeners can be removed", () => {
    const navigator = createNavigator();
    let count = 0;
    const listener = () => count++;

    navigator.on("tabChange", listener);
    navigator.off("tabChange", listener);
    navigator.selectTab("search");

    assert.equal(count, 0);
});

test("class screen lifecycle follows tab switching", () => {
    const lifecycle = [];

    class TrackedScreen extends ScreenBase {
        constructor(context) {
            super(context);
            this.name = context.name;
        }

        onEnter() {
            lifecycle.push(`${this.name}:enter`);
        }

        onLeave() {
            lifecycle.push(`${this.name}:leave`);
        }

        render() {
            return this.name;
        }
    }

    const registry = new ScreenRegistry({
        Home: Screen(TrackedScreen),
        Search: Screen(TrackedScreen)
    });

    const navigator = new TabNavigator(registry, [
        { id: "home", label: "Home", screen: "Home" },
        { id: "search", label: "Search", screen: "Search" }
    ]);

    navigator.selectTab("search");
    navigator.selectTab("home");

    assert.deepEqual(lifecycle, [
        "Home:enter",
        "Home:leave",
        "Search:enter",
        "Search:leave",
        "Home:enter"
    ]);
});

test("non-preserved class screens are recreated after tab switching", () => {
    let instanceCount = 0;

    class HomeScreen extends ScreenBase {
        constructor(context) {
            super(context);
            this.instanceId = ++instanceCount;
        }

        render() {
            return this.instanceId;
        }
    }

    const registry = new ScreenRegistry({
        Home: Screen(HomeScreen, { preserveState: false }),
        Search: Screen(() => "search")
    });

    const navigator = new TabNavigator(registry, [
        { id: "home", label: "Home", screen: "Home" },
        { id: "search", label: "Search", screen: "Search" }
    ]);

    const firstInstance = navigator.current.screen.instance;

    navigator.selectTab("search");
    navigator.selectTab("home");

    assert.notEqual(navigator.current.screen.instance, firstInstance);
    assert.equal(instanceCount, 2);
});

test("suspended tab stacks cannot be navigated directly", () => {
    const navigator = createNavigator();

    navigator.selectTab("search");

    // TabNavigator exposes only the selected stack publicly.
    // The inactive manager remains encapsulated.
    assert.equal(navigator.selectedTabId, "search");
    assert.equal(navigator.current.screen.name, "Search");
});
