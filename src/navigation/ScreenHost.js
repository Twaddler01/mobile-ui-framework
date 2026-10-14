import DOMRenderer from "../renderers/dom/DOMRenderer.js";

export default class ScreenHost {
    constructor(navigation, renderer = new DOMRenderer()) {
        if (
            !navigation ||
            typeof navigation.on !== "function" ||
            typeof navigation.off !== "function"
        ) {
            throw new TypeError(
                "ScreenHost requires a ScreenManager or TabNavigator."
            );
        }

        if (!renderer || typeof renderer.render !== "function") {
            throw new TypeError(
                "ScreenHost requires a renderer with a render() method."
            );
        }

        this.navigation = navigation;
        this.renderer = renderer;

        this.container = null;
        this._listener = () => this._renderCurrent();
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
        this._renderCurrent(container);

        this.container = container;
        this.navigation.on("change", this._listener);

        return this;
    }

    unmount() {
        if (!this.container) {
            return this;
        }

        this.navigation.off("change", this._listener);

        this.container.replaceChildren();
        this.container = null;

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

    _renderCurrent(container = this.container) {
        if (!container) {
            return null;
        }

        const output = this._getCurrentOutput();

        return this.renderer.render(output, container);
    }
}
