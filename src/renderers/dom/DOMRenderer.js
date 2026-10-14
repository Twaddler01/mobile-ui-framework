import { normalizeLayoutProps } from "../../core/Layout.js";
import normalizeComponent from "../../core/normalizeComponent.js";

export default class DOMRenderer {
    render(component, container) {
        if (!(container instanceof Element)) {
            throw new TypeError("DOMRenderer requires a valid DOM container.");
        }

        const normalized = normalizeComponent(component);
        const element = this.createElement(normalized);

        container.replaceChildren(element);

        return element;
    }

    createElement(component) {
        if (typeof component === "string" || typeof component === "number") {
            return document.createTextNode(String(component));
        }

        const props = component.props ?? {};
        const type = component.type;

        if (type === "fragment") {
            const fragment = document.createDocumentFragment();

            for (const child of component.children ?? []) {
                fragment.appendChild(this.createElement(child));
            }

            return fragment;
        }

        const isLayout = type === "column" || type === "row";

        const tagName =
            type === "button"
                ? "button"
                : (props.tagName ??
                  (type === "card"
                      ? "article"
                      : type === "text"
                        ? "p"
                        : "div"));

        const element = document.createElement(tagName);

        if (isLayout || type === "card" || type === "button") {
            element.classList.add(`ui-${type}`);
        }

        if (type === "button") {
            element.classList.add(
                `ui-button-${props.variant}`,
                `ui-button-${props.size}`
            );

            element.disabled = Boolean(props.disabled);
            element.type = props.type;
        }

        if (
            isLayout ||
            type === "card" ||
            type === "button" ||
            type === "text"
        ) {
            element.classList.add(`ui-${type}`);
        }

        if (type === "button") {
            element.classList.add(
                `ui-button-${props.variant}`,
                `ui-button-${props.size}`
            );

            element.disabled = Boolean(props.disabled);
            element.type = props.type;
        }

        if (type === "text") {
            element.classList.add(`ui-text-${props.size}`);

            if (props.color) {
                element.style.color = props.color;
            }

            if (props.weight != null) {
                element.style.fontWeight = props.weight;
            }

            if (props.align) {
                element.style.textAlign = props.align;
            }
        }

        if (props.className) {
            element.classList.add(...props.className.trim().split(/\s+/));
        }

        this.applyLayout(element, props);

        if (props.attributes) {
            for (const [name, value] of Object.entries(props.attributes)) {
                if (value == null || value === false) {
                    continue;
                }

                element.setAttribute(name, value === true ? "" : String(value));
            }
        }

        if (typeof props.onClick === "function") {
            element.addEventListener("click", props.onClick);
        }

        for (const child of component.children ?? []) {
            element.appendChild(this.createElement(child));
        }

        return element;
    }

    applyLayout(element, props) {
        const layoutProps = element.classList.contains("ui-text")
            ? { ...props, align: undefined }
            : props;

        const layout = normalizeLayoutProps(layoutProps);
        const style = element.style;

        const alignValues = {
            start: "flex-start",
            center: "center",
            end: "flex-end",
            stretch: "stretch"
        };

        const justifyValues = {
            start: "flex-start",
            center: "center",
            end: "flex-end",
            between: "space-between",
            around: "space-around",
            evenly: "space-evenly"
        };

        for (const name of ["gap", "padding", "width", "height"]) {
            if (layout[name] != null) {
                style[name] = this.toCssSize(layout[name]);
            }
        }

        if (layout.align) {
            style.alignItems = alignValues[layout.align];
        }

        if (layout.justify) {
            style.justifyContent = justifyValues[layout.justify];
        }

        // Explicit custom styles override generated layout styles.
        if (props.style) {
            Object.assign(style, props.style);
        }

        if (props.wrap != null) {
            element.style.flexWrap =
                props.wrap === true
                    ? "wrap"
                    : props.wrap === false
                        ? "nowrap"
                        : props.wrap;
        }
    }

    toCssSize(value) {
        return typeof value === "number" ? `${value}px` : value;
    }
}
