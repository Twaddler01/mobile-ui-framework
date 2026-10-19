const DEFAULT_MIN_DISTANCE = 60;
const DEFAULT_MIN_VELOCITY = 0.3;
const DEFAULT_DIRECTION_RATIO = 1.5;
const CLAIM_DISTANCE = 10;

function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export default class SwipeNavigation {
    constructor(navigator, options = {}) {
        if (
            !navigator ||
            typeof navigator.selectTab !== "function" ||
            !Array.isArray(navigator.tabs)
        ) {
            throw new TypeError("SwipeNavigation requires a TabNavigator.");
        }

        if (!isPlainObject(options)) {
            throw new TypeError(
                "SwipeNavigation options must be a plain object."
            );
        }

        const allowed = new Set([
            "minDistance",
            "minVelocity",
            "directionRatio",
            "wrap",
            "ignoreSelector"
        ]);

        for (const key of Object.keys(options)) {
            if (!allowed.has(key)) {
                throw new TypeError(`Unknown SwipeNavigation option "${key}".`);
            }
        }

        const minDistance = options.minDistance ?? DEFAULT_MIN_DISTANCE;
        if (typeof minDistance !== "number" || minDistance < 0) {
            throw new TypeError(
                "SwipeNavigation minDistance must be a non-negative number."
            );
        }

        const minVelocity = options.minVelocity ?? DEFAULT_MIN_VELOCITY;
        if (typeof minVelocity !== "number" || minVelocity < 0) {
            throw new TypeError(
                "SwipeNavigation minVelocity must be a non-negative number."
            );
        }

        const directionRatio =
            options.directionRatio ?? DEFAULT_DIRECTION_RATIO;
        if (typeof directionRatio !== "number" || directionRatio < 1) {
            throw new TypeError(
                "SwipeNavigation directionRatio must be a number >= 1."
            );
        }

        if (options.wrap !== undefined && typeof options.wrap !== "boolean") {
            throw new TypeError("SwipeNavigation wrap must be a boolean.");
        }

        if (
            options.ignoreSelector !== undefined &&
            typeof options.ignoreSelector !== "string"
        ) {
            throw new TypeError(
                "SwipeNavigation ignoreSelector must be a string."
            );
        }

        this.navigator = navigator;
        this.minDistance = minDistance;
        this.minVelocity = minVelocity;
        this.directionRatio = directionRatio;
        this.wrap = options.wrap ?? false;
        this.ignoreSelector = options.ignoreSelector ?? null;

        this.container = null;
        this._pointer = null;

        this._onPointerDown = event => this._handlePointerDown(event);
        this._onPointerMove = event => this._handlePointerMove(event);
        this._onPointerUp = event => this._handlePointerUp(event);
        this._onPointerCancel = event => this._handlePointerCancel(event);
    }

    get isMounted() {
        return this.container !== null;
    }

    mount(container) {
        if (!(container instanceof Element)) {
            throw new TypeError(
                "SwipeNavigation requires a valid DOM container."
            );
        }

        if (this.container) {
            throw new Error(
                "SwipeNavigation is already mounted. Unmount it first."
            );
        }

        this.container = container;

        container.addEventListener("pointerdown", this._onPointerDown);
        // Move/up on document so the gesture survives
        // the pointer leaving the container mid-swipe.
        document.addEventListener("pointermove", this._onPointerMove);
        document.addEventListener("pointerup", this._onPointerUp);
        document.addEventListener("pointercancel", this._onPointerCancel);

        return this;
    }

    unmount() {
        if (!this.container) return this;

        this.container.removeEventListener("pointerdown", this._onPointerDown);
        document.removeEventListener("pointermove", this._onPointerMove);
        document.removeEventListener("pointerup", this._onPointerUp);
        document.removeEventListener("pointercancel", this._onPointerCancel);

        this.container = null;
        this._pointer = null;

        return this;
    }

    // Testability seam — tests override this instance method.
    _now() {
        return performance.now();
    }

    _handlePointerDown(event) {
        if (event.isPrimary === false) return;
        if (this._pointer !== null) return;

        if (this.ignoreSelector) {
            const target =
                event.target instanceof Element ? event.target : null;

            if (target?.closest(this.ignoreSelector)) return;
        }

        this._pointer = {
            id: event.pointerId ?? 0,
            startX: event.clientX,
            startY: event.clientY,
            startTime: this._now(),
            claimed: false
        };
    }

    _handlePointerMove(event) {
        if (!this._pointer) return;
        if ((event.pointerId ?? 0) !== this._pointer.id) return;

        const dx = event.clientX - this._pointer.startX;
        const dy = event.clientY - this._pointer.startY;

        if (this._pointer.claimed) return;

        if (Math.hypot(dx, dy) < CLAIM_DISTANCE) return;

        const horizontalWins =
            Math.abs(dx) >= Math.abs(dy) * this.directionRatio;

        if (horizontalWins) {
            this._pointer.claimed = true;
        } else {
            // Vertical dominates — let the browser have it.
            this._pointer = null;
        }
    }

    _handlePointerUp(event) {
        if (!this._pointer) return;
        if ((event.pointerId ?? 0) !== this._pointer.id) return;

        const pointer = this._pointer;
        this._pointer = null;

        if (!pointer.claimed) return;

        const dx = event.clientX - pointer.startX;
        if (dx === 0) return;

        const duration = Math.max(1, this._now() - pointer.startTime);
        const velocity = Math.abs(dx) / duration;

        const meetsThreshold =
            Math.abs(dx) >= this.minDistance || velocity >= this.minVelocity;

        if (!meetsThreshold) return;

        // Paging only at tab root.
        if (this.navigator.stack.length !== 1) return;

        const tabs = this.navigator.tabs;
        if (tabs.length < 2) return;

        const currentIndex = tabs.findIndex(
            tab => tab.id === this.navigator.selectedTabId
        );
        if (currentIndex < 0) return;

        // Swipe left (dx < 0) → next tab.
        // Swipe right (dx > 0) → previous tab.
        const targetIndex = currentIndex - Math.sign(dx);

        let resolved = targetIndex;

        if (this.wrap) {
            resolved = (targetIndex + tabs.length) % tabs.length;
        } else if (targetIndex < 0 || targetIndex >= tabs.length) {
            return;
        }

        this.navigator.selectTab(tabs[resolved].id);
    }

    _handlePointerCancel(event) {
        if (!this._pointer) return;
        if ((event.pointerId ?? 0) !== this._pointer.id) return;
        this._pointer = null;
    }
}
