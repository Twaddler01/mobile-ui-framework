import { isScreenDefinition } from "./Screen.js";

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

function validateScreenName(name) {
    if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
        throw new TypeError(
            `Invalid screen name "${name}". ` +
                "Names must start with a letter and contain only " +
                "letters, numbers, underscores, or hyphens."
        );
    }
}

export default class ScreenRegistry {
    constructor(screens = {}) {
        if (!isPlainObject(screens)) {
            throw new TypeError(
                "Screen definitions must be provided as a plain object."
            );
        }

        this.screens = new Map();

        for (const [name, definition] of Object.entries(screens)) {
            this.register(name, definition);
        }
    }

    register(name, definition) {
        validateScreenName(name);

        if (!isScreenDefinition(definition)) {
            throw new TypeError(
                `Screen "${name}" must be created with Screen().`
            );
        }

        if (this.screens.has(name)) {
            throw new Error(`Screen "${name}" is already registered.`);
        }

        this.screens.set(name, definition);

        return definition;
    }

    get(name) {
        return this.screens.get(name) ?? null;
    }

    require(name) {
        const definition = this.get(name);

        if (!definition) {
            throw new Error(`Unknown screen "${name}".`);
        }

        return definition;
    }

    has(name) {
        return this.screens.has(name);
    }

    list() {
        return [...this.screens.keys()];
    }
}
