import test from "node:test";
import assert from "node:assert/strict";

import validateComponent from "../src/core/validateComponent.js";
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

test("registered schemas and nested rules are immutable", () => {
    const schema = getComponentSchema("button");

    assert.ok(Object.isFrozen(schema));
    assert.ok(Object.isFrozen(schema.properties));
    assert.ok(Object.isFrozen(schema.properties.variant.values));
    assert.ok(Object.isFrozen(schema.defaults));

    assert.throws(() => {
        schema.defaults.variant = "ghost";
    }, TypeError);

    assert.throws(() => {
        schema.properties.variant.values.push("danger");
    }, TypeError);
});

test("required properties are enforced", () => {
    registerComponentSchema("test-required-field", {
        properties: {
            label: { kind: "string" }
        },
        required: ["label"]
    });

    assert.ok(
        validateComponent("test-required-field", {}).some(
            error => error.includes('Required property "label"')
        )
    );

    assert.deepEqual(
        validateComponent("test-required-field", {
            label: "Continue"
        }),
        []
    );
});

test("custom validators reject out-of-range numbers", () => {
    registerComponentSchema("test-progress-meter", {
        properties: {
            value: {
                kind: "number",
                validate: value =>
                    value >= 0 && value <= 100
                        ? true
                        : "Value must be between 0 and 100."
            }
        },
        required: ["value"]
    });

    assert.deepEqual(
        validateComponent("test-progress-meter", {
            value: 50
        }),
        []
    );

    assert.ok(
        validateComponent("test-progress-meter", {
            value: 120
        }).some(error => error.includes("between 0 and 100"))
    );
});

test("invalid custom validators are rejected during registration", () => {
    assert.throws(() => {
        registerComponentSchema("test-bad-validator", {
            properties: {
                value: {
                    kind: "number",
                    validate: "not a function"
                }
            }
        });
    }, TypeError);
});
