import test from "node:test";
import assert from "node:assert/strict";

import {
    Column,
    Text,
    Button,
    validateDefinition,
    normalizeComponent,
    registerComponentSchema,
    getComponentSchema,
    hasComponentSchema,
    listComponentTypes
} from "../src/ui.js";

test("built-in schemas are registered", () => {
    assert.equal(hasComponentSchema("column"), true);
    assert.equal(hasComponentSchema("text"), true);
    assert.equal(hasComponentSchema("button"), true);
});

test("valid component trees pass validation", () => {
    const view = Column({ gap: 12, padding: 20 }, [
        Text({ size: "title" }, ["Welcome"]),
        Button({ variant: "primary" }, ["Continue"])
    ]);

    const result = validateDefinition(view);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});

test("invalid properties are reported", () => {
    const result = validateDefinition({
        type: "button",
        props: {
            variant: "mystery",
            disabled: "no"
        },
        children: ["Test"]
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("variant")));
    assert.ok(result.errors.some(error => error.includes("disabled")));
});

test("normalization applies defaults", () => {
    const normalized = normalizeComponent({
        type: "button",
        props: {},
        children: ["Continue"]
    });

    assert.equal(normalized.props.variant, "primary");
    assert.equal(normalized.props.size, "medium");
    assert.equal(normalized.props.disabled, false);
    assert.equal(normalized.props.type, "button");
});

test("invalid definitions cannot be normalized", () => {
    assert.throws(
        () =>
            normalizeComponent({
                type: "column",
                props: { gap: -1 },
                children: []
            }),
        /validation failed/i
    );
});

test("unknown properties are rejected", () => {
    const result = validateDefinition({
        type: "text",
        props: { colour: "red" },
        children: ["Hello"]
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("colour")));
});

test("custom component schemas can be registered", () => {
    registerComponentSchema("test-label", {
        properties: {
            tone: {
                kind: "enum",
                values: ["neutral", "success", "warning"]
            }
        },
        defaults: {
            tone: "neutral"
        }
    });

    assert.equal(hasComponentSchema("test-label"), true);
    assert.equal(getComponentSchema("test-label").defaults.tone, "neutral");

    assert.ok(listComponentTypes().includes("test-label"));

    const result = validateDefinition({
        type: "test-label",
        props: { tone: "success" },
        children: ["Ready"]
    });

    assert.equal(result.valid, true);

    const normalized = normalizeComponent({
        type: "test-label",
        props: {},
        children: ["Ready"]
    });

    assert.equal(normalized.props.tone, "neutral");
});

test("duplicate registration is rejected by default", () => {
    assert.throws(
        () =>
            registerComponentSchema("button", {
                properties: {},
                defaults: {}
            }),
        /already registered/i
    );
});

test("malformed schema definitions are rejected", () => {
    assert.throws(
        () =>
            registerComponentSchema("bad-test", {
                properties: {
                    tone: { kind: "made-up-rule" }
                },
                defaults: {}
            }),
        /unsupported rule kind/i
    );
});
