export default class TabBar {
    constructor(navigation) {
        if (
            !navigation ||
            typeof navigation.selectTab !== "function" ||
            typeof navigation.on !== "function" ||
            typeof navigation.off !== "function"
        ) {
            throw new TypeError("TabBar requires a TabNavigator.");
        }

        this.navigation = navigation;
        this.container = null;
        this.tabList = null;
        this.buttons = new Map();
        this._listener = () => this._updateSelection();
    }

    get isMounted() {
        return this.container !== null;
    }

    get element() {
        return this.tabList;
    }

    mount(target) {
        if (!(target instanceof Element)) {
            throw new TypeError("TabBar requires a valid DOM container.");
        }

        if (this.container) {
            throw new Error("TabBar is already mounted. Unmount it first.");
        }

        const tabs = this.navigation.tabs;

        if (!Array.isArray(tabs) || tabs.length === 0) {
            throw new Error("TabBar requires at least one configured tab.");
        }

        const nav = document.createElement("div");
        nav.className = "tab-bar";
        nav.setAttribute("role", "tablist");
        nav.setAttribute("aria-label", "Main navigation");

        const nextButtons = new Map();

        for (const tab of tabs) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "tab-bar__button";
            button.setAttribute("role", "tab");
            button.setAttribute("aria-label", tab.label);
            button.setAttribute("aria-selected", "false");
            button.setAttribute("data-tab-id", tab.id);
            button.tabIndex = -1;

            if (tab.icon) {
                const icon = document.createElement("span");
                icon.className = "tab-bar__icon";
                icon.setAttribute("aria-hidden", "true");
                icon.textContent = tab.icon;
                button.appendChild(icon);
            }

            const label = document.createElement("span");
            label.className = "tab-bar__label";
            label.textContent = tab.label;
            button.appendChild(label);

            button.addEventListener("click", () =>
                this._handleTabClick(tab.id)
            );

            nextButtons.set(tab.id, button);
            nav.appendChild(button);
        }

        target.replaceChildren(nav);

        this.container = target;
        this.tabList = nav;

        for (const [id, button] of nextButtons) {
            this.buttons.set(id, button);
        }

        this.navigation.on("change", this._listener);
        this._updateSelection();

        return this;
    }

    unmount() {
        if (!this.container) {
            return this;
        }

        this.navigation.off("change", this._listener);

        this.container.replaceChildren();

        this.container = null;
        this.tabList = null;
        this.buttons.clear();

        return this;
    }

    _updateSelection() {
        if (!this.container) {
            return;
        }

        const selectedTabId = this.navigation.selectedTabId;

        for (const [id, button] of this.buttons) {
            const selected = id === selectedTabId;

            button.setAttribute("aria-selected", String(selected));
            button.classList.toggle("is-selected", selected);
            button.tabIndex = selected ? 0 : -1;
        }
    }

    _handleTabClick(id) {
        this.navigation.selectTab(id);
        this._updateSelection();
    }
}
