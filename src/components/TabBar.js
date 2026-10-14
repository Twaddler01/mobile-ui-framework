export default function TabBar(navigation) {
    if (
        !navigation ||
        typeof navigation.selectTab !== "function" ||
        typeof navigation.on !== "function" ||
        typeof navigation.off !== "function"
    ) {
        throw new TypeError("TabBar requires a TabNavigator.");
    }

    let container = null;
    let tabList = null;

    const buttons = new Map();

    function updateSelection() {
        if (!container) {
            return;
        }

        const selectedTabId = navigation.selectedTabId;

        for (const [id, button] of buttons) {
            const selected = id === selectedTabId;

            button.setAttribute("aria-selected", String(selected));

            button.classList.toggle("is-selected", selected);

            button.tabIndex = selected ? 0 : -1;
        }
    }

    function handleNavigationChange() {
        updateSelection();
    }

    function handleTabClick(id) {
        navigation.selectTab(id);
        updateSelection();
    }

    function mount(target) {
        if (!(target instanceof Element)) {
            throw new TypeError("TabBar requires a valid DOM container.");
        }

        if (container) {
            throw new Error("TabBar is already mounted. Unmount it first.");
        }

        const tabs = navigation.tabs;

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

            button.addEventListener("click", () => {
                handleTabClick(tab.id);
            });

            nextButtons.set(tab.id, button);
            nav.appendChild(button);
        }

        // Prepare the DOM before subscribing, so a failed
        // initial render cannot leave an orphaned listener.
        target.replaceChildren(nav);

        container = target;
        tabList = nav;

        for (const [id, button] of nextButtons) {
            buttons.set(id, button);
        }

        navigation.on("change", handleNavigationChange);
        updateSelection();

        return api;
    }

    function unmount() {
        if (!container) {
            return api;
        }

        navigation.off("change", handleNavigationChange);

        container.replaceChildren();

        container = null;
        tabList = null;
        buttons.clear();

        return api;
    }

    const api = {
        mount,
        unmount,

        get isMounted() {
            return container !== null;
        },

        get element() {
            return tabList;
        }
    };

    return api;
}
