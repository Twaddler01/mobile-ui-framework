import test from "node:test";
import assert from "node:assert/strict";

import {
    Screen,
    ScreenBase,
    ScreenRegistry,
    isScreenDefinition
} from "../src/ui.js";

test("factory screens create valid definitions", () => {
    const render = () => "home";
    const definition = Screen(render);

    assert.equal(isScreenDefinition(definition), true);
    assert.equal(definition.kind, "factory");
    assert.equal(definition.render, render);
    assert.equal(definition.ScreenClass, null);
});

test("screen preservation defaults to true", () => {
    const definition = Screen(() => null);

    assert.equal(definition.options.preserveState, true);
});

test("screen preservation can be disabled", () => {
    const definition = Screen(() => null, { preserveState: false });

    assert.equal(definition.options.preserveState, false);
});

test("screen definitions and options are immutable", () => {
    const definition = Screen(() => null);

    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.options), true);

    assert.throws(() => {
        definition.options.preserveState = false;
    }, TypeError);
});

test("invalid screen render targets are rejected", () => {
    assert.throws(
        () => Screen(null),
        /render function or a ScreenBase subclass/i
    );

    assert.throws(
        () => Screen("not a function"),
        /render function or a ScreenBase subclass/i
    );
});

test("screen options must be plain objects", () => {
    assert.throws(
        () => Screen(() => null, null),
        /options must be a plain object/i
    );

    assert.throws(
        () => Screen(() => null, []),
        /options must be a plain object/i
    );
});

test("unknown screen options are rejected", () => {
    assert.throws(
        () => Screen(() => null, { animation: "slide" }),
        /Unknown screen option "animation"/
    );
});

test("preserveState must be a boolean", () => {
    assert.throws(
        () => Screen(() => null, { preserveState: "yes" }),
        /preserveState.*boolean/i
    );
});

test("class-based screens must extend ScreenBase", () => {
    class InvalidScreen {
        render() {
            return null;
        }
    }

    assert.throws(() => Screen(InvalidScreen), /must extend ScreenBase/i);
});

test("class-based screens must implement render", () => {
    class IncompleteScreen extends ScreenBase {}

    assert.throws(() => Screen(IncompleteScreen), /must implement render/i);
});

test("class-based screens preserve their class definition", () => {
    class SettingsScreen extends ScreenBase {
        render() {
            return "settings";
        }
    }

    const definition = Screen(SettingsScreen);

    assert.equal(definition.kind, "class");
    assert.equal(definition.ScreenClass, SettingsScreen);
    assert.equal(definition.render, null);
});

test("ScreenBase stores its context", () => {
    const context = { params: { section: "general" } };
    const screen = new ScreenBase(context);

    assert.equal(screen.context, context);
    assert.equal(screen.context.params.section, "general");
});

test("ScreenBase requires render to be implemented", () => {
    const screen = new ScreenBase();

    assert.throws(() => screen.render(), /render\(\) must be implemented/i);
});

test("registry accepts named screen definitions", () => {
    const registry = new ScreenRegistry({
        home: Screen(() => "home"),
        settings: Screen(() => "settings")
    });

    assert.equal(registry.has("home"), true);
    assert.equal(registry.has("settings"), true);
    assert.equal(registry.has("missing"), false);

    assert.equal(registry.get("home").kind, "factory");
    assert.deepEqual(registry.list(), ["home", "settings"]);
});

test("registry rejects duplicate names", () => {
    const registry = new ScreenRegistry({
        home: Screen(() => "home")
    });

    assert.throws(
        () =>
            registry.register(
                "home",
                Screen(() => "other")
            ),
        /already registered/i
    );
});

test("registry rejects invalid screen names", () => {
    const registry = new ScreenRegistry();

    assert.throws(
        () =>
            registry.register(
                "home screen",
                Screen(() => null)
            ),
        /Invalid screen name/
    );

    assert.throws(
        () =>
            registry.register(
                "1home",
                Screen(() => null)
            ),
        /Invalid screen name/
    );
});

test("registry rejects unwrapped screen definitions", () => {
    const registry = new ScreenRegistry();

    assert.throws(
        () => registry.register("home", () => "home"),
        /must be created with Screen\(\)/i
    );
});

test("registry require reports unknown screen names", () => {
    const registry = new ScreenRegistry({
        home: Screen(() => "home")
    });

    assert.throws(
        () => registry.require("missing"),
        /Unknown screen "missing"/
    );
});

test("registry accepts class-based screens", () => {
    class ProfileScreen extends ScreenBase {
        render() {
            return "profile";
        }
    }

    const registry = new ScreenRegistry({
        profile: Screen(ProfileScreen, { preserveState: false })
    });

    const definition = registry.require("profile");

    assert.equal(definition.kind, "class");
    assert.equal(definition.options.preserveState, false);
});
