import DOMRenderer from "../renderers/dom/DOMRenderer.js";
import ScreenTransition from "./ScreenTransition.js";

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function directionFor(action) {
    if (action === "navigate") return "forward";
    if (action === "back") return "backward";
    return "fade";
}

export default class ScreenHost {
    constructor(navigation, renderer, options = {}) {
        if (isPlainObject(renderer)) {
            [renderer, options] = [new DOMRenderer(), renderer];
        }

        if (renderer === undefined || renderer === null) {
            renderer = new DOMRenderer();
        }

        if (
            !navigation ||
            typeof navigation.on !== "function" ||
            typeof navigation.off !== "function"
        ) {
            throw new TypeError(
                "ScreenHost requires a ScreenManager or TabNavigator."
            );
        }

        if (
            !renderer ||
            typeof renderer.render !== "function" ||
            typeof renderer.renderToElement !== "function"
        ) {
            throw new TypeError(
                "ScreenHost requires a renderer with render() and renderToElement() methods."
            );
        }

        if (!isPlainObject(options)) {
            throw new TypeError("ScreenHost options must be a plain object.");
        }

        for (const key of Object.keys(options)) {
            if (key !== "transition" && key !== "preserveScroll") {
                throw new TypeError(`Unknown ScreenHost option "${key}".`);
            }
        }

        this.preserveScroll = options.preserveScroll ?? true;

        if (typeof this.preserveScroll !== "boolean") {
            throw new TypeError(
                'ScreenHost option "preserveScroll" must be a boolean.'
            );
        }

        this.navigation = navigation;
        this.renderer = renderer;

        const transitionOption = options.transition;

        if (transitionOption === false) {
            this.transition = null;
        } else if (
            transitionOption === undefined ||
            transitionOption === true
        ) {
            this.transition = new ScreenTransition();
        } else if (isPlainObject(transitionOption)) {
            this.transition = new ScreenTransition(transitionOption);
        } else {
            throw new TypeError(
                'ScreenHost option "transition" must be a boolean or a plain object.'
            );
        }

        this.container = null;
        this._currentElement = null;
        this._currentScrollKey = null;
        this._scrollPositions = new Map(); // entryId -> scrollTop
        this._listener = event => this._renderCurrent(this.container, event);
    }

    get isMounted() {
        return this.container !== null;
    }

    mount(container) {
        if (!(container instanceof Element)) {
            throw new TypeError("ScreenHost requires a valid DOM container.");
        }

        if (this.container) {
            throw new Error("ScreenHost is already mounted. Unmount it first.");
        }

        // Render first so a rendering failure doesn't leave
        // a partially mounted host or an orphaned listener.
        this._renderCurrent(container, null);

        this.container = container;
        container.classList.add("screen-host");

        this.navigation.on("change", this._listener);

        return this;
    }

    unmount() {
        if (!this.container) return this;

        this.navigation.off("change", this._listener);
        this.transition?.destroy();
        this.container.replaceChildren();
        this.container.classList.remove("screen-host");

        this.container = null;
        this._currentElement = null;
        this._currentScrollKey = null;
        this._scrollPositions.clear();

        return this;
    }

    _getCurrentOutput() {
        const current = this.navigation.current;

        if (!current) {
            throw new Error(
                "ScreenHost cannot render because no screen is active."
            );
        }

        // TabNavigator.current wraps its screen snapshot;
        // ScreenManager.current is already the screen snapshot.
        const screen = current.screen ?? current;

        if (!screen || screen.output === undefined) {
            throw new Error("The active screen has no render output.");
        }

        return screen.output;
    }

    // add above _renderCurrent
    _scrollKey() {
        const current = this.navigation.current;
        if (!current) return null;

        const entryId = current.screen?.id ?? current.id;

        if (entryId === undefined || entryId === null) return null;

        const tabId = current.tabId;

        return tabId !== undefined ? `${tabId}:${entryId}` : `_:${entryId}`;
    }

    _renderCurrent(container = this.container, event = null) {
        if (!container) return null;

        // 1. Capture from the outgoing screen, keyed by tab + entry.
        if (
            this.preserveScroll &&
            this._currentScrollKey !== null &&
            this._currentElement
        ) {
            const scrollTop = this._currentElement.scrollTop;

            if (scrollTop > 0) {
                this._scrollPositions.set(this._currentScrollKey, scrollTop);
            } else {
                this._scrollPositions.delete(this._currentScrollKey);
            }
        }

        // 2. Resolve the incoming output and key.
        const output = this._getCurrentOutput();

        const newScrollKey = this._scrollKey();

        const incoming = this.renderer.renderToElement(output);
        const outgoing = this._currentElement;

        this._currentElement = incoming;
        this._currentScrollKey = newScrollKey;

        incoming.classList.add("screen-host__screen");

        // 3. Transition or hard swap.
        if (this.transition && outgoing && event) {
            this.transition.play({
                container,
                outgoing,
                incoming,
                direction: directionFor(event.action)
            });
        } else {
            container.replaceChildren(incoming);
        }

        // 4. Restore — only for the same tab + entry.
        if (this.preserveScroll && newScrollKey !== null) {
            const saved = this._scrollPositions.get(newScrollKey);

            if (saved !== undefined) {
                incoming.scrollTop = saved;
            }
        }

        return incoming;
    }
}
