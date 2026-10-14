
import ScreenBase from "./ScreenBase.js";

const SCREEN_DEFINITION = Symbol("screen-definition");

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
        prototype === Object.prototype ||
        prototype === null
    );
}

function isClassConstructor(value) {
    return /^class\s/.test(
        Function.prototype.toString.call(value)
    );
}

export function isScreenDefinition(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        value[SCREEN_DEFINITION] === true
    );
}

export default function Screen(renderOrClass, options = {}) {
    if (typeof renderOrClass !== "function") {
        throw new TypeError(
            "Screen requires a render function or a ScreenBase subclass."
        );
    }

    if (!isPlainObject(options)) {
        throw new TypeError(
            "Screen options must be a plain object."
        );
    }

    for (const key of Object.keys(options)) {
        if (key !== "preserveState") {
            throw new TypeError(
                `Unknown screen option "${key}".`
            );
        }
    }

    if (
        options.preserveState !== undefined &&
        typeof options.preserveState !== "boolean"
    ) {
        throw new TypeError(
            'Screen option "preserveState" must be a boolean.'
        );
    }

    const isScreenClass =
        renderOrClass.prototype instanceof ScreenBase;

    if (
        isClassConstructor(renderOrClass) &&
        !isScreenClass
    ) {
        throw new TypeError(
            "Class-based screens must extend ScreenBase."
        );
    }

    if (
        isScreenClass &&
        renderOrClass.prototype.render === ScreenBase.prototype.render
    ) {
        throw new TypeError(
            "A ScreenBase subclass must implement render()."
        );
    }

    const definition = {
        kind: isScreenClass ? "class" : "factory",

        render: isScreenClass ? null : renderOrClass,

        ScreenClass: isScreenClass ? renderOrClass : null,

        options: Object.freeze({
            preserveState: options.preserveState ?? true
        })
    };

    Object.defineProperty(definition, SCREEN_DEFINITION, {
        value: true
    });

    return Object.freeze(definition);
}
