const STATE_VERSION = 1;
const VALID_MODES = Object.freeze(["hash", "history"]);

function toSlug(name) {
    return String(name)
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/_/g, "-")
        .toLowerCase();
}

function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export default class HistorySync {
    constructor(navigator, options = {}) {
        if (
            !navigator ||
            typeof navigator.on !== "function" ||
            typeof navigator.off !== "function" ||
            typeof navigator.restore !== "function"
        ) {
            throw new TypeError(
                "HistorySync requires a TabNavigator with restore()."
            );
        }

        if (!isPlainObject(options)) {
            throw new TypeError("HistorySync options must be a plain object.");
        }

        for (const key of Object.keys(options)) {
            if (key !== "mode" && key !== "basePath") {
                throw new TypeError(`Unknown HistorySync option "${key}".`);
            }
        }

        const mode = options.mode ?? "hash";
        if (!VALID_MODES.includes(mode)) {
            throw new TypeError(
                `HistorySync mode must be one of: ${VALID_MODES.join(", ")}.`
            );
        }

        const basePath = options.basePath ?? "";
        if (typeof basePath !== "string") {
            throw new TypeError("HistorySync basePath must be a string.");
        }

        this.navigator = navigator;
        this.mode = mode;
        this.basePath = basePath.replace(/\/+$/, "");

        this._started = false;
        this._suppress = false;
        this._pendingPop = false;
        this._historyPointer = 0;
        this._slugToName = this._buildSlugMap();
        this._lastOp = "init";

        this._onChange = event => this._handleChange(event);
        this._onPopState = event => this._handlePopState(event);
    }

    get isStarted() {
        return this._started;
    }

    start() {
        if (this._started) return this;

        this._historyPointer = 0;
        this._pendingPop = false;
        this._lastOp = "init";

        this._restoreOnStart();
        this._writeState({ replace: true });

        this.navigator.on("change", this._onChange);
        window.addEventListener("popstate", this._onPopState);
        this._started = true;

        return this;
    }

    stop() {
        if (!this._started) return this;

        this.navigator.off("change", this._onChange);
        window.removeEventListener("popstate", this._onPopState);

        this._started = false;
        this._pendingPop = false;

        return this;
    }

    _buildSlugMap() {
        const map = new Map();
        const registry = this.navigator.registry;

        if (!registry || typeof registry.list !== "function") {
            return map;
        }

        for (const name of registry.list()) {
            const slug = toSlug(name);

            if (map.has(slug) && map.get(slug) !== name) {
                console.warn(
                    `HistorySync: screen names "${map.get(slug)}" and "${name}" both slug to "${slug}". ` +
                        "Deep links to this screen will be ambiguous."
                );
            }

            map.set(slug, name);
        }

        return map;
    }

    _handleChange(event) {
        if (this._suppress) return;

        if (event.action === "back") {
            this._handleAppBack();
            return;
        }

        if (event.action === "forward") {
            this._handleAppForward();
            return;
        }

        const replace = event.action === "selectTab";
        this._writeState({ replace });
    }

    _handleAppBack() {
        // Defensive: if a previous history.back() never fired popstate,
        // prefer replaceState over compounding broken state.
        if (this._pendingPop) {
            this._pendingPop = false;
            this._writeState({ replace: true });
            return;
        }

        if (this._historyPointer > 0) {
            this._historyPointer -= 1;
            this._pendingPop = true;
            this._lastOp = "back";
            history.back();
        } else {
            // No prior app entry (fresh deep-link paste, or start-of-session).
            // Replacing keeps browser history honest at the cost of the
            // pasted entry — the correct trade-off.
            this._writeState({ replace: true });
        }
    }

    _handleAppForward() {
        if (this._pendingPop) {
            // Previous forward() never received its popstate; treat the
            // app as already in the target state.
            this._pendingPop = false;
            this._writeState({ replace: true });
            return;
        }

        if (this._lastOp === "pop") {
            this._pendingPop = true;
            this._historyPointer += 1;
            this._lastOp = "forward";
            history.forward();
        } else {
            this._writeState({ replace: true });
        }
    }

    _handlePopState(event) {
        // Only the skip branch updates _lastOp. Browser-initiated pops leave
        // it intact, so a subsequent app-forward() will prefer replaceState
        // over history.forward() — safe, at the cost of clobbering a real
        // forward entry. Precise tracking would need a direction signal
        // popstate doesn't expose.

        if (this._pendingPop) {
            // Consequence of our own history.back(). The app stack
            // already matches what the browser just landed on.
            this._pendingPop = false;
            this._lastOp = "pop";
            return;
        }

        // Browser-initiated pop — sync our pointer from the state
        // the browser just revealed. Unknown states count as "bottom".
        this._historyPointer =
            typeof event.state?._pointer === "number"
                ? event.state._pointer
                : 0;

        this._suppress = true;

        try {
            const state = event.state;

            if (
                state?.version === STATE_VERSION &&
                state.tabId &&
                Array.isArray(state.stack) &&
                state.stack.length > 0
            ) {
                this.navigator.restore(state.tabId, state.stack);
                return;
            }

            const parsed = this._parseLocation();
            if (parsed) {
                this.navigator.restore(parsed.tabId, parsed.entries);
            }
        } catch (error) {
            console.error("HistorySync: popstate restore failed", error);
        } finally {
            this._suppress = false;
        }
    }

    _restoreOnStart() {
        if (history.state?.version === STATE_VERSION) {
            if (typeof history.state._pointer === "number") {
                this._historyPointer = history.state._pointer;
            }

            try {
                this.navigator.restore(
                    history.state.tabId,
                    history.state.stack
                );
                return true;
            } catch (error) {
                console.error(
                    "HistorySync: restore from state failed, falling back to URL",
                    error
                );
            }
        }

        const parsed = this._parseLocation();

        if (parsed) {
            try {
                this.navigator.restore(parsed.tabId, parsed.entries);
                return true;
            } catch (error) {
                console.error("HistorySync: restore from URL failed", error);
            }
        }

        return false;
    }

    _parseLocation() {
        let route;

        if (this.mode === "hash") {
            route = location.hash.slice(1);
            if (!route || !route.startsWith("/")) return null;
        } else {
            const path = location.pathname;
            if (this.basePath) {
                if (!path.startsWith(this.basePath)) return null;
                route = path.slice(this.basePath.length) || "/";
            } else {
                route = path;
            }
            route += location.search;
        }

        const [pathPart, queryPart = ""] = route.split("?");
        const segments = pathPart.split("/").filter(Boolean);
        if (segments.length === 0) return null;

        const tabId = this._findTabBySlug(segments[0]);
        if (!tabId) return null;

        const tab = this.navigator.tabs.find(entry => entry.id === tabId);
        if (!tab) return null;

        const entries = [{ name: tab.screen, params: {} }];

        for (let i = 1; i < segments.length; i++) {
            const name = this._slugToName.get(segments[i]);
            if (!name) return null;
            entries.push({ name, params: {} });
        }

        const params = Object.fromEntries(new URLSearchParams(queryPart));
        entries[entries.length - 1].params = params;

        return { tabId, entries };
    }

    _findTabBySlug(slug) {
        for (const tab of this.navigator.tabs) {
            if (toSlug(tab.id) === slug) return tab.id;
        }
        return null;
    }

    _writeState({ replace }) {
        const current = this.navigator.current;
        if (!current) return;

        const tabId = current.tabId ?? this.navigator.selectedTabId;
        if (!tabId) return;

        const stack = this.navigator.stack;
        if (!Array.isArray(stack) || stack.length === 0) return;

        if (!replace) {
            this._historyPointer += 1;
            this._lastOp = "push";
        }

        const route = this._buildRoute(tabId, stack);
        const url = this._buildUrl(route);

        const state = {
            version: STATE_VERSION,
            _pointer: this._historyPointer,
            tabId,
            stack: stack.map(entry => ({
                name: entry.name,
                params: entry.params ?? {}
            }))
        };

        const method = replace ? "replaceState" : "pushState";

        try {
            history[method](state, "", url);
        } catch (error) {
            console.error("HistorySync: failed to write URL", error);
        }
    }

    _buildRoute(tabId, stack) {
        const tabSlug = toSlug(tabId);
        const rest = stack.slice(1).map(entry => toSlug(entry.name));
        const path = "/" + [tabSlug, ...rest].join("/");

        const topParams = stack[stack.length - 1].params ?? {};
        const query = new URLSearchParams(topParams).toString();

        return query ? `${path}?${query}` : path;
    }

    _buildUrl(route) {
        if (this.mode === "hash") {
            return `${location.pathname}${location.search}#${route}`;
        }
        return `${this.basePath}${route}`;
    }
}
