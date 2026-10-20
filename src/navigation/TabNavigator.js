import ScreenManager from "./ScreenManager.js";

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

function validateTabs(tabs) {
    if (!Array.isArray(tabs) || tabs.length === 0) {
        throw new TypeError("TabNavigator requires a non-empty array of tabs.");
    }

    const ids = new Set();

    return tabs.map((tab, index) => {
        if (!isPlainObject(tab)) {
            throw new TypeError(
                `Tab at index ${index} must be a plain object.`
            );
        }

        for (const key of Object.keys(tab)) {
            if (!["id", "label", "icon", "screen"].includes(key)) {
                throw new TypeError(`Unknown tab property "${key}".`);
            }
        }

        if (
            typeof tab.id !== "string" ||
            !/^[A-Za-z][A-Za-z0-9_-]*$/.test(tab.id)
        ) {
            throw new TypeError(`Invalid tab id "${tab.id}".`);
        }

        if (ids.has(tab.id)) {
            throw new Error(`Tab "${tab.id}" is already defined.`);
        }

        ids.add(tab.id);

        if (typeof tab.label !== "string" || tab.label.trim() === "") {
            throw new TypeError(`Tab "${tab.id}" requires a non-empty label.`);
        }

        if (
            tab.icon !== undefined &&
            (typeof tab.icon !== "string" || tab.icon.trim() === "")
        ) {
            throw new TypeError(
                `Tab "${tab.id}" icon must be a non-empty string.`
            );
        }

        if (typeof tab.screen !== "string" || tab.screen.trim() === "") {
            throw new TypeError(
                `Tab "${tab.id}" requires an initial screen name.`
            );
        }

        return Object.freeze({
            id: tab.id,
            label: tab.label,
            icon: tab.icon ?? null,
            screen: tab.screen
        });
    });
}

export default class TabNavigator {
    constructor(registry, tabs) {
        if (!registry || typeof registry.require !== "function") {
            throw new TypeError("TabNavigator requires a ScreenRegistry.");
        }

        this.registry = registry;
        this._tabs = validateTabs(tabs);
        this._tabById = new Map();
        this._managers = new Map();
        this._listeners = new Map();
        this._selectedTabId = null;

        for (const tab of this._tabs) {
            // Fail early if a tab references an unknown screen.
            this.registry.require(tab.screen);

            this._tabById.set(tab.id, tab);
            this._managers.set(tab.id, new ScreenManager(this.registry));
        }

        this.selectTab(this._tabs[0].id);
    }

    get selectedTabId() {
        return this._selectedTabId;
    }

    get current() {
        const manager = this._getCurrentManager();

        if (!manager || !manager.current) {
            return null;
        }

        return Object.freeze({
            tabId: this._selectedTabId,
            tab: this._tabById.get(this._selectedTabId),
            screen: manager.current
        });
    }

    get tabs() {
        return Object.freeze(
            this._tabs.map(tab =>
                Object.freeze({
                    ...tab,
                    selected: tab.id === this._selectedTabId,
                    initialized: this._managers.get(tab.id).stack.length > 0,
                    stackLength: this._managers.get(tab.id).stack.length
                })
            )
        );
    }

    get stack() {
        const manager = this._getCurrentManager();

        return manager ? manager.stack : Object.freeze([]);
    }

    canGoBack() {
        const manager = this._getCurrentManager();
        return manager ? manager.canGoBack() : false;
    }

    canGoForward() {
        // ← new
        const manager = this._getCurrentManager();
        return manager ? manager.canGoForward() : false;
    }

    selectTab(id, params = {}) {
        const tab = this._tabById.get(id);

        if (!tab) {
            throw new Error(`Unknown tab "${id}".`);
        }

        if (id === this._selectedTabId) {
            return this.current;
        }

        const previousId = this._selectedTabId;
        const previousManager = previousId
            ? this._managers.get(previousId)
            : null;
        const nextManager = this._managers.get(id);

        if (previousManager) {
            previousManager.suspend();
        }

        try {
            if (nextManager.stack.length === 0) {
                nextManager.navigate(tab.screen, params);
            } else {
                nextManager.resume();
            }
        } catch (error) {
            if (previousManager) {
                try {
                    previousManager.resume();
                } catch (recoveryError) {
                    throw new AggregateError(
                        [error, recoveryError],
                        "Tab selection failed and the previous tab " +
                            "could not be resumed."
                    );
                }
            }

            throw error;
        }

        this._selectedTabId = id;

        this._emit("tabChange", this._createEvent("selectTab", previousId, id));

        this._emit("change", this._createEvent("selectTab", previousId, id));

        return this.current;
    }

    navigate(name, params = {}) {
        const manager = this._requireCurrentManager();
        const result = manager.navigate(name, params);

        this._emit(
            "change",
            this._createEvent(
                "navigate",
                this._selectedTabId,
                this._selectedTabId
            )
        );

        return result;
    }

    back() {
        const manager = this._requireCurrentManager();
        const result = manager.back();
        if (result === false) return false;

        this._emit(
            "change",
            this._createEvent("back", this._selectedTabId, this._selectedTabId)
        );

        return this.current;
    }

    forward() {
        // ← new
        const manager = this._requireCurrentManager();
        const result = manager.forward();

        if (result === false) {
            return false;
        }

        this._emit(
            "change",
            this._createEvent(
                "forward",
                this._selectedTabId,
                this._selectedTabId
            )
        );

        return this.current;
    }

    replace(name, params = {}) {
        const manager = this._requireCurrentManager();
        manager.replace(name, params);

        this._emit(
            "change",
            this._createEvent(
                "replace",
                this._selectedTabId,
                this._selectedTabId
            )
        );

        return this.current;
    }

    reset(name, params = {}) {
        const manager = this._requireCurrentManager();
        manager.reset(name, params);

        this._emit(
            "change",
            this._createEvent("reset", this._selectedTabId, this._selectedTabId)
        );

        return this.current;
    }

    restore(tabId, entries, { silent = false } = {}) {
        const tab = this._tabById.get(tabId);

        if (!tab) {
            throw new Error(`Unknown tab "${tabId}".`);
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            throw new TypeError(
                "restore() requires a non-empty array of entries."
            );
        }

        for (const entry of entries) {
            if (!entry || typeof entry.name !== "string") {
                throw new TypeError(
                    "restore() entries require a string 'name' property."
                );
            }

            // Pre-flight: throw before mutating any state so a bad entry
            // can't leave the tab half-restored.
            this.registry.require(entry.name);
        }

        const manager = this._managers.get(tabId);
        const prevId = this._selectedTabId;

        // Suspend the outgoing tab so its stack stops receiving events.
        if (prevId && prevId !== tabId) {
            this._managers.get(prevId).suspend();
        }

        // reset() throws on a suspended manager. resume() is a no-op
        // when the target is already active.
        if (manager.isSuspended) {
            manager.resume();
        }

        manager.reset(entries[0].name, entries[0].params ?? {});

        for (let i = 1; i < entries.length; i++) {
            manager.navigate(entries[i].name, entries[i].params ?? {});
        }

        this._selectedTabId = tabId;

        if (!silent) {
            this._emit("change", this._createEvent("restore", prevId, tabId));
        }

        return this.current;
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

    _getCurrentManager() {
        return this._selectedTabId
            ? this._managers.get(this._selectedTabId)
            : null;
    }

    _requireCurrentManager() {
        const manager = this._getCurrentManager();

        if (!manager) {
            throw new Error("No tab is currently selected.");
        }

        return manager;
    }

    _createEvent(action, previousTabId, tabId) {
        const manager = this._getCurrentManager();

        return Object.freeze({
            action,
            previousTabId,
            tabId,
            canGoBack: manager ? manager.canGoBack() : false,
            canGoForward: manager ? manager.canGoForward() : false,
            current: this.current,
            tabs: this.tabs,
            stack: this.stack
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
}
