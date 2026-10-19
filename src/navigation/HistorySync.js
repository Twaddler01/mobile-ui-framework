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
            typeof navigator.off !== "function"
        ) {
            throw new TypeError("HistorySync requires a TabNavigator.");
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
        this._slugToName = this._buildSlugMap();
        this._onChange = event => this._handleChange(event);
    }

    get isStarted() {
        return this._started;
    }

    start() {
        if (this._started) return this;

        this._writeState({ replace: true });
        this.navigator.on("change", this._onChange);
        this._started = true;

        return this;
    }

    stop() {
        if (!this._started) return this;

        this.navigator.off("change", this._onChange);
        this._started = false;

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

        // Tab switch replaces so browser Back doesn't ping-pong between tabs.
        const replace = event.action === "selectTab";
        this._writeState({ replace });
    }

    _writeState({ replace }) {
        const current = this.navigator.current;

        if (!current) return;

        const tabId = current.tabId ?? this.navigator.selectedTabId;
        if (!tabId) return;

        const stack = this.navigator.stack;
        if (!Array.isArray(stack) || stack.length === 0) return;

        const route = this._buildRoute(tabId, stack);
        const url = this._buildUrl(route);

        const state = {
            version: STATE_VERSION,
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

        // Only top-of-stack params go into the URL.
        // Intermediate params survive via history.state (see _writeState).
        const topParams = stack[stack.length - 1].params ?? {};
        const query = new URLSearchParams(topParams).toString();

        return query ? `${path}?${query}` : path;
    }

    _buildUrl(route) {
        if (this.mode === "hash") {
            // Preserve the app's physical path and any pre-existing search.
            return `${location.pathname}${location.search}#${route}`;
        }

        return `${this.basePath}${route}`;
    }
}
