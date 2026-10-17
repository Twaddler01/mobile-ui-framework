const DEFAULT_DURATION = 300;
const FALLBACK_GRACE = 50;
const DURATION_PROPERTY = "--screen-transition-duration";

const SCREEN_CLASS = "screen-host__screen";
const CURRENT_CLASS = "screen-host__screen--current";
const LEAVING_CLASS = "screen-host__screen--leaving";

const DIRECTIONS = new Set(["forward", "backward", "fade"]);

function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export default class ScreenTransition {
    constructor(options = {}) {
        if (!isPlainObject(options)) {
            throw new TypeError("ScreenTransition options must be a plain object.");
        }

        for (const key of Object.keys(options)) {
            if (key !== "duration") {
                throw new TypeError(`Unknown ScreenTransition option "${key}".`);
            }
        }

        const duration = options.duration ?? DEFAULT_DURATION;

        if (
            typeof duration !== "number" ||
            !Number.isFinite(duration) ||
            duration < 0
        ) {
            throw new TypeError(
                "ScreenTransition duration must be a non-negative number."
            );
        }

        this.duration = duration;
        this._active = null;

        this._mediaQuery =
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function"
                ? window.matchMedia("(prefers-reduced-motion: reduce)")
                : null;
    }

    get isAnimating() {
        return this._active !== null;
    }

    play({ container, outgoing, incoming, direction = "fade", onComplete } = {}) {
        if (!(container instanceof Element)) {
            throw new TypeError(
                "ScreenTransition.play() requires a DOM container."
            );
        }

        if (!(incoming instanceof Element)) {
            throw new TypeError(
                "ScreenTransition.play() requires an incoming element."
            );
        }

        if (
            outgoing !== undefined &&
            outgoing !== null &&
            !(outgoing instanceof Element)
        ) {
            throw new TypeError(
                "ScreenTransition.play() outgoing must be an Element or null."
            );
        }

        if (!DIRECTIONS.has(direction)) {
            throw new TypeError(
                `Unknown ScreenTransition direction "${direction}".`
            );
        }

        // An in-flight transition is force-completed rather than queued.
        // A second tap should feel responsive, not sluggish.
        if (this._active) {
            try {
                this._finish();
            } catch (error) {
                console.error(
                    "ScreenTransition: previous onComplete threw during interrupt",
                    error
                );
            }
        }

        const canAnimate =
            outgoing instanceof Element &&
            outgoing !== incoming &&
            outgoing.parentNode === container &&
            !this._prefersReducedMotion() &&
            this.duration > 0;

        if (!canAnimate) {
            if (
                outgoing instanceof Element &&
                outgoing !== incoming &&
                outgoing.parentNode
            ) {
                outgoing.remove();
            }
            if (!incoming.isConnected) {
                container.appendChild(incoming);
            }
            incoming.classList.add(SCREEN_CLASS);
            onComplete?.();
            return;
        }

        const directionToken = `screen-host--${direction}`;

        container.style.setProperty(DURATION_PROPERTY, `${this.duration}ms`);
        container.classList.add(directionToken);

        incoming.classList.add(SCREEN_CLASS, CURRENT_CLASS);
        outgoing.classList.add(SCREEN_CLASS, LEAVING_CLASS);

        container.appendChild(incoming);

        // Force a synchronous style flush so the browser observes the
        // "from" state of the animation before the next paint.
        void incoming.getBoundingClientRect();

        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            this._finish();
        };

        incoming.addEventListener("animationend", finish);

        const timer = setTimeout(finish, this.duration + FALLBACK_GRACE);

        this._active = {
            container,
            outgoing,
            incoming,
            directionToken,
            onComplete,
            cleanup: () => {
                clearTimeout(timer);
                incoming.removeEventListener("animationend", finish);
            }
        };
    }

    cancel() {
        this._finish();
    }

    destroy() {
        this._finish();
    }

    _prefersReducedMotion() {
        return this._mediaQuery?.matches === true;
    }

    _finish() {
        const active = this._active;

        if (!active) {
            return;
        }

        this._active = null;

        const {
            cleanup,
            onComplete,
            container,
            outgoing,
            incoming,
            directionToken
        } = active;

        cleanup();

        if (outgoing && outgoing.parentNode === container) {
            outgoing.remove();
        }

        incoming.classList.remove(CURRENT_CLASS, LEAVING_CLASS);

        if (outgoing) {
            outgoing.classList.remove(CURRENT_CLASS, LEAVING_CLASS);
        }

        container.classList.remove(directionToken);

        onComplete?.();
    }
}