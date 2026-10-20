function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

function normalizeParams(params) {
    if (params === undefined) {
        return Object.freeze({});
    }

    if (!isPlainObject(params)) {
        throw new TypeError("Screen parameters must be a plain object.");
    }

    return Object.freeze({ ...params });
}

export default class ScreenManager {
    constructor(registry) {
        if (!registry || typeof registry.require !== "function") {
            throw new TypeError("ScreenManager requires a ScreenRegistry.");
        }

        this.registry = registry;
        this._stack = [];
        this._forward = [];
        this._listeners = new Map();

        this._listeners = new Map();
        this._nextEntryId = 1;
        this._suspended = false;
    }

    get current() {
        const entry = this._getCurrentEntry();

        return entry ? this._createSnapshot(entry) : null;
    }

    get stack() {
        return Object.freeze(
            this._stack.map(entry => this._createSnapshot(entry))
        );
    }

    canGoBack() {
        return this._stack.length > 1;
    }

    canGoForward() {
        return this._forward.length > 0;
    }

    get forwardStack() {
        return Object.freeze(
            this._forward.map(entry => this._createSnapshot(entry))
        );
    }

    on(eventName, listener) {
        if (typeof eventName !== "string" || eventName.trim() === "") {
            throw new TypeError("Event name must be a non-empty string.");
        }

        if (typeof listener !== "function") {
            throw new TypeError("Event listener must be a function.");
        }

        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }

        this._listeners.get(eventName).add(listener);

        return this;
    }

    off(eventName, listener) {
        const listeners = this._listeners.get(eventName);

        if (listeners) {
            listeners.delete(listener);

            if (listeners.size === 0) {
                this._listeners.delete(eventName);
            }
        }

        return this;
    }

    navigate(name, params = {}) {
        this._assertAvailable();

        const entry = this._createEntry(name, params);
        const previous = this._getCurrentEntry();

        if (previous) {
            this._deactivateForTransition(previous);
        }

        this._stack.push(entry);
        this._forward = [];

        try {
            this._activate(entry);
        } catch (error) {
            this._stack.pop();
            if (previous) this._activate(previous);
            throw error;
        }

        this._emitNavigation("navigate", previous, entry);

        return this.current;
    }

    forward() {
        this._assertAvailable();

        if (!this.canGoForward()) {
            return false;
        }

        const leaving = this._getCurrentEntry();
        const next = this._forward[this._forward.length - 1];

        this._deactivateForTransition(leaving);
        this._forward.pop();

        this._stack.push(next);

        try {
            this._activate(next);
        } catch (error) {
            this._stack.pop();
            this._forward.push(next);
            this._activate(leaving);
            throw error;
        }

        this._emitNavigation("forward", leaving, next);

        return this.current;
    }

    back() {
        this._assertAvailable();

        if (!this.canGoBack()) {
            return false;
        }

        const leaving = this._getCurrentEntry();
        const previous = this._stack[this._stack.length - 2];

        this._deactivateForTransition(leaving);
        this._stack.pop();

        try {
            this._activate(previous);
        } catch (error) {
            this._stack.push(leaving);
            this._activate(leaving);
            throw error;
        }

        this._forward.push(leaving); // ← new — only after activation succeeds

        this._emitNavigation("back", leaving, previous);

        return this.current;
    }

    replace(name, params = {}) {
        this._assertAvailable();

        const entry = this._createEntry(name, params);
        const previous = this._getCurrentEntry();

        if (!previous) {
            this._stack.push(entry);
            this._forward = [];

            try {
                this._activate(entry);
            } catch (error) {
                this._stack.pop();
                throw error;
            }

            this._emitNavigation("replace", null, entry);

            return this.current;
        }

        this._deactivateForTransition(previous);
        this._stack.pop();
        this._stack.push(entry);
        this._forward = [];

        try {
            this._activate(entry);
        } catch (error) {
            this._stack.pop();
            this._stack.push(previous);
            this._activate(previous);

            throw error;
        }

        this._disposeEntry(previous);
        this._emitNavigation("replace", previous, entry);

        return this.current;
    }

    reset(name, params = {}) {
        this._assertAvailable();

        const entry = this._createEntry(name, params);
        const previousStack = [...this._stack];
        const previous = this._getCurrentEntry();

        if (previous) {
            this._deactivateForTransition(previous);
        }

        this._stack = [entry];
        this._forward = [];

        try {
            this._activate(entry);
        } catch (error) {
            this._stack = previousStack;

            if (previous) {
                this._activate(previous);
            }

            throw error;
        }

        for (const oldEntry of previousStack) {
            this._disposeEntry(oldEntry);
        }

        this._emitNavigation("reset", previous, entry);

        return this.current;
    }

    get isSuspended() {
        return this._suspended;
    }

    suspend() {
        if (this._suspended) {
            return false;
        }

        const current = this._getCurrentEntry();

        if (current) {
            this._deactivateForTransition(current);
        }

        this._suspended = true;
        return true;
    }

    resume() {
        if (!this._suspended) {
            return false;
        }

        const current = this._getCurrentEntry();

        if (current) {
            this._activate(current);
        }

        this._suspended = false;
        return true;
    }

    _assertAvailable() {
        if (this._suspended) {
            throw new Error(
                "Cannot navigate a suspended screen stack. " +
                    "Resume it first."
            );
        }
    }

    _createEntry(name, params) {
        const definition = this.registry.require(name);

        return {
            id: this._nextEntryId++,
            name,
            params: normalizeParams(params),
            definition,
            instance: null,
            output: undefined,
            rendered: false,
            active: false
        };
    }

    _getCurrentEntry() {
        return this._stack.length ? this._stack[this._stack.length - 1] : null;
    }

    _createContext(entry) {
        return Object.freeze({
            name: entry.name,
            params: entry.params,
            entryId: entry.id,
            navigation: this
        });
    }

    _activate(entry) {
        if (entry.active) {
            return;
        }

        const context = this._createContext(entry);

        entry.active = true;

        try {
            if (entry.definition.kind === "class") {
                if (!entry.instance) {
                    entry.instance = new entry.definition.ScreenClass(context);
                }

                entry.instance.onEnter();

                if (!entry.rendered) {
                    entry.output = entry.instance.render();
                    entry.rendered = true;
                }
            } else if (!entry.rendered) {
                entry.output = entry.definition.render(context);
                entry.rendered = true;
            }
        } catch (error) {
            entry.active = false;

            if (entry.instance) {
                try {
                    entry.instance.onDispose();
                } finally {
                    entry.instance = null;
                }
            }

            entry.output = undefined;
            entry.rendered = false;

            throw error;
        }
    }

    _deactivate(entry) {
        if (!entry || !entry.active) {
            return;
        }

        // If onLeave fails, the screen remains active.
        if (entry.instance) {
            entry.instance.onLeave();
        }

        entry.active = false;

        if (!entry.definition.options.preserveState) {
            this._disposeInstance(entry);
            entry.output = undefined;
            entry.rendered = false;
        }
    }

    _deactivateForTransition(entry) {
        try {
            this._deactivate(entry);
        } catch (error) {
            // A failed onLeave leaves the screen active.
            // A failed disposal may happen after deactivation,
            // so attempt to restore that screen.
            if (!entry.active) {
                try {
                    this._activate(entry);
                } catch (recoveryError) {
                    throw new AggregateError(
                        [error, recoveryError],
                        "Screen transition failed and the previous screen " +
                            "could not be restored."
                    );
                }
            }

            throw error;
        }
    }

    _disposeInstance(entry) {
        if (!entry.instance) {
            return;
        }

        const instance = entry.instance;

        entry.instance = null;

        try {
            instance.onDispose();
        } finally {
            entry.output = undefined;
            entry.rendered = false;
        }
    }

    _disposeEntry(entry) {
        if (!entry) {
            return;
        }

        this._disposeInstance(entry);

        entry.output = undefined;
        entry.rendered = false;
        entry.active = false;
    }

    _createSnapshot(entry) {
        return Object.freeze({
            id: entry.id,
            name: entry.name,
            params: entry.params,
            output: entry.output,
            instance: entry.instance,
            active: entry.active
        });
    }

    _emit(eventName, event) {
        const listeners = this._listeners.get(eventName);

        if (!listeners) {
            return;
        }

        for (const listener of [...listeners]) {
            listener(event);
        }
    }

    _emitNavigation(action, previous, current) {
        const event = Object.freeze({
            action,
            previous: previous ? this._createSnapshot(previous) : null,
            current: this._createSnapshot(current),
            stack: this.stack
        });

        this._emit(action, event);
        this._emit("change", event);
    }
}
