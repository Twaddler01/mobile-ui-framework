import test from "node:test";
import assert from "node:assert/strict";

import Screen from "../src/navigation/Screen.js";
import ScreenBase from "../src/navigation/ScreenBase.js";
import ScreenRegistry from "../src/navigation/ScreenRegistry.js";
import ScreenManager from "../src/navigation/ScreenManager.js";

function createManager(screens) {
    return new ScreenManager(new ScreenRegistry(screens));
}

test("navigate opens a screen and passes its parameters", () => {
    const manager = createManager({
        Home: Screen(({ name }) => ({ screen: name })),
        Details: Screen(context => ({
            screen: context.name,
            params: context.params
        }))
    });

    manager.navigate("Home");

    const current = manager.navigate("Details", {
        itemId: 42
    });

    assert.equal(current.name, "Details");
    assert.deepEqual(current.params, { itemId: 42 });
    assert.deepEqual(current.output, {
        screen: "Details",
        params: { itemId: 42 }
    });
    assert.equal(manager.stack.length, 2);
});

test("navigation parameters must be a plain object", () => {
    const manager = createManager({
        Home: Screen(() => "home")
    });

    assert.throws(() => manager.navigate("Home", null), /plain object/);

    assert.throws(() => manager.navigate("Home", ["invalid"]), /plain object/);
});

test("unknown screens are rejected", () => {
    const manager = createManager({
        Home: Screen(() => "home")
    });

    assert.throws(() => manager.navigate("Missing"), /Unknown screen/);
});

test("canGoBack reflects the stack", () => {
    const manager = createManager({
        Home: Screen(() => "home"),
        Details: Screen(() => "details")
    });

    assert.equal(manager.canGoBack(), false);

    manager.navigate("Home");
    assert.equal(manager.canGoBack(), false);

    manager.navigate("Details");
    assert.equal(manager.canGoBack(), true);

    manager.back();
    assert.equal(manager.canGoBack(), false);
});

test("back returns to the previous screen", () => {
    const manager = createManager({
        Home: Screen(() => "home"),
        Details: Screen(() => "details"),
        Settings: Screen(() => "settings")
    });

    manager.navigate("Home");
    manager.navigate("Details");
    manager.navigate("Settings");

    const current = manager.back();

    assert.equal(current.name, "Details");
    assert.equal(manager.stack.length, 2);
});

test("back returns false when there is no previous screen", () => {
    const manager = createManager({
        Home: Screen(() => "home")
    });

    manager.navigate("Home");

    assert.equal(manager.back(), false);
    assert.equal(manager.current.name, "Home");
});

test("replace replaces the current stack entry", () => {
    const manager = createManager({
        Home: Screen(() => "home"),
        Details: Screen(() => "details"),
        Login: Screen(() => "login")
    });

    manager.navigate("Home");
    manager.navigate("Details");
    manager.replace("Login");

    assert.equal(manager.current.name, "Login");
    assert.deepEqual(
        manager.stack.map(entry => entry.name),
        ["Home", "Login"]
    );
});

test("reset clears the stack", () => {
    const manager = createManager({
        Home: Screen(() => "home"),
        Details: Screen(() => "details"),
        Login: Screen(() => "login")
    });

    manager.navigate("Home");
    manager.navigate("Details");
    manager.reset("Login", { reason: "signed-out" });

    assert.equal(manager.stack.length, 1);
    assert.equal(manager.current.name, "Login");
    assert.deepEqual(manager.current.params, {
        reason: "signed-out"
    });
});

test("screen snapshots and stack are read-only", () => {
    const manager = createManager({
        Home: Screen(() => "home")
    });

    manager.navigate("Home");

    assert.equal(Object.isFrozen(manager.current), true);
    assert.equal(Object.isFrozen(manager.current.params), true);
    assert.equal(Object.isFrozen(manager.stack), true);

    assert.throws(() => {
        manager.current.name = "Changed";
    }, TypeError);

    assert.throws(() => {
        manager.current.params.value = 1;
    }, TypeError);
});

test("factory output is preserved when preserveState is true", () => {
    let renderCount = 0;

    const manager = createManager({
        Home: Screen(() => {
            renderCount++;
            return { renderCount };
        }),
        Details: Screen(() => "details")
    });

    manager.navigate("Home");
    const originalOutput = manager.current.output;

    manager.navigate("Details");
    manager.back();

    assert.equal(renderCount, 1);
    assert.equal(manager.current.output, originalOutput);
});

test("factory output is recreated when preserveState is false", () => {
    let renderCount = 0;

    const manager = createManager({
        Home: Screen(() => ({ renderCount: ++renderCount }), {
            preserveState: false
        }),
        Details: Screen(() => "details")
    });

    manager.navigate("Home");
    assert.equal(manager.current.output.renderCount, 1);

    manager.navigate("Details");
    manager.back();

    assert.equal(manager.current.name, "Home");
    assert.equal(manager.current.output.renderCount, 2);
});

test("class screens retain their instance when state is preserved", () => {
    const instances = [];

    class HomeScreen extends ScreenBase {
        constructor(context) {
            super(context);
            this.enterCount = 0;
            this.leaveCount = 0;
            this.renderCount = 0;
            instances.push(this);
        }

        onEnter() {
            this.enterCount++;
        }

        onLeave() {
            this.leaveCount++;
        }

        render() {
            this.renderCount++;
            return { screen: "home" };
        }
    }

    const manager = createManager({
        Home: Screen(HomeScreen),
        Details: Screen(() => "details")
    });

    manager.navigate("Home");
    const originalInstance = manager.current.instance;

    manager.navigate("Details");
    manager.back();

    assert.equal(manager.current.instance, originalInstance);
    assert.equal(instances.length, 1);
    assert.equal(originalInstance.enterCount, 2);
    assert.equal(originalInstance.leaveCount, 1);
    assert.equal(originalInstance.renderCount, 1);
});

test("class screens are recreated when state is not preserved", () => {
    const instances = [];
    let disposedCount = 0;

    class HomeScreen extends ScreenBase {
        constructor(context) {
            super(context);
            instances.push(this);
        }

        onDispose() {
            disposedCount++;
        }

        render() {
            return { screen: "home" };
        }
    }

    const manager = createManager({
        Home: Screen(HomeScreen, { preserveState: false }),
        Details: Screen(() => "details")
    });

    manager.navigate("Home");
    const firstInstance = manager.current.instance;

    manager.navigate("Details");

    assert.equal(disposedCount, 1);

    manager.back();

    assert.notEqual(manager.current.instance, firstInstance);
    assert.equal(instances.length, 2);
});

test("popped class screens are disposed when forward stack clears", () => {
    let disposed = 0;
    class Detail extends ScreenBase {
        render() {
            return { type: "element", props: {}, children: ["d"] };
        }
        onDispose() {
            disposed += 1;
        }
    }

    const registry = new ScreenRegistry({
        Home: Screen(() => ({
            type: "element",
            props: {},
            children: ["h"]
        })),
        Details: Screen(Detail)
    });

    const manager = new ScreenManager(registry);
    manager.navigate("Home");
    manager.navigate("Details");
    manager.back();

    assert.equal(disposed, 0, "back() must NOT dispose — forward can revive");

    manager.navigate("Home"); // clears forward stack
    assert.equal(disposed, 1, "disposed when forward is cleared");
});
test("navigation events report actions and current screen", () => {
    const manager = createManager({
        Home: Screen(() => "home"),
        Details: Screen(() => "details")
    });

    const actions = [];
    const changes = [];

    manager.on("navigate", event => {
        actions.push(event.current.name);
    });

    manager.on("change", event => {
        changes.push(event.action);
    });

    manager.navigate("Home");
    manager.navigate("Details");
    manager.back();

    assert.deepEqual(actions, ["Home", "Details"]);
    assert.deepEqual(changes, ["navigate", "navigate", "back"]);
});

test("listeners can be removed", () => {
    const manager = createManager({
        Home: Screen(() => "home")
    });

    let count = 0;
    const listener = () => count++;

    manager.on("navigate", listener);
    manager.off("navigate", listener);
    manager.navigate("Home");

    assert.equal(count, 0);
});

test("invalid listeners are rejected", () => {
    const manager = createManager({});

    assert.throws(
        () => manager.on("change", "not a function"),
        /listener must be a function/
    );
});

test("render failures do not leave a broken new stack entry", () => {
    const manager = createManager({
        Home: Screen(() => "home"),
        Broken: Screen(() => {
            throw new Error("render failed");
        })
    });

    manager.navigate("Home");

    assert.throws(() => manager.navigate("Broken"), /render failed/);

    assert.equal(manager.current.name, "Home");
    assert.equal(manager.stack.length, 1);
});

test("onLeave failure leaves the current screen active", () => {
    class HomeScreen extends ScreenBase {
        onLeave() {
            throw new Error("leave failed");
        }

        render() {
            return "home";
        }
    }

    const manager = createManager({
        Home: Screen(HomeScreen),
        Details: Screen(() => "details")
    });

    manager.navigate("Home");

    assert.throws(() => manager.navigate("Details"), /leave failed/);

    assert.equal(manager.stack.length, 1);
    assert.equal(manager.current.name, "Home");
    assert.equal(manager.current.active, true);
});

test("onDispose failure does not leave navigation inactive", () => {
    let instanceCount = 0;

    class HomeScreen extends ScreenBase {
        constructor(context) {
            super(context);
            instanceCount++;
        }

        onDispose() {
            throw new Error("dispose failed");
        }

        render() {
            return "home";
        }
    }

    const manager = createManager({
        Home: Screen(HomeScreen, { preserveState: false }),
        Details: Screen(() => "details")
    });

    manager.navigate("Home");

    assert.throws(() => manager.navigate("Details"), /dispose failed/);

    assert.equal(manager.stack.length, 1);
    assert.equal(manager.current.name, "Home");
    assert.equal(manager.current.active, true);
    assert.ok(instanceCount >= 1);
});

test("reset disposes preserved class screens throughout the stack", () => {
    const disposed = [];

    class TrackedScreen extends ScreenBase {
        constructor(context) {
            super(context);
            this.screenName = context.name;
        }

        render() {
            return this.screenName;
        }

        onDispose() {
            disposed.push(this.screenName);
        }
    }

    const manager = createManager({
        Home: Screen(TrackedScreen),
        Details: Screen(TrackedScreen),
        Login: Screen(() => "login")
    });

    manager.navigate("Home");
    manager.navigate("Details");
    manager.reset("Login");

    assert.deepEqual([...disposed].sort(), ["Details", "Home"]);

    assert.deepEqual(
        manager.stack.map(entry => entry.name),
        ["Login"]
    );
});

test("navigate() disposes forward entries even if onDispose throws", () => {
    let attempts = 0;
    class Detail extends ScreenBase {
        render() {
            return { type: "element", props: {}, children: ["d"] };
        }
        onDispose() {
            attempts += 1;
            throw new Error("details disposal failed");
        }
    }

    const registry = new ScreenRegistry({
        Home: Screen(() => ({
            type: "element",
            props: {},
            children: ["h"]
        })),
        Details: Screen(Detail)
    });

    const manager = new ScreenManager(registry);
    manager.navigate("Home");
    manager.navigate("Details");
    manager.back();

    // Forward stack now holds the Details entry.
    assert.throws(() => manager.navigate("Home"), /details disposal failed/);
    assert.equal(attempts, 1);
});

test("reset attempts to dispose every old screen after a disposal error", () => {
    const disposed = [];

    class TrackedScreen extends ScreenBase {
        constructor(context) {
            super(context);
            this.screenName = context.name;
        }

        render() {
            return this.screenName;
        }

        onDispose() {
            disposed.push(this.screenName);

            if (this.screenName === "Details") {
                throw new Error("details disposal failed");
            }
        }
    }

    const manager = createManager({
        Home: Screen(TrackedScreen),
        Details: Screen(TrackedScreen),
        Login: Screen(() => "login")
    });

    manager.navigate("Home");
    manager.navigate("Details");

    assert.throws(() => manager.reset("Login"), /details disposal failed/);

    // Reset committed, so Login is active despite the cleanup error.
    assert.equal(manager.stack.length, 1);
    assert.equal(manager.current.name, "Login");
    assert.equal(manager.current.active, true);

    // Cleanup must continue after the first failure.
    assert.deepEqual([...disposed].sort(), ["Details", "Home"]);
});
