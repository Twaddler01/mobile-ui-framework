export default class Component {
    constructor(type = "element", props = {}, children = []) {
        this.type = type;
        this.props = { ...props };
        this.children = [];

        for (const child of children) {
            this.add(child);
        }
    }

    add(child) {
        const validChild =
            child instanceof Component ||
            typeof child === "string" ||
            typeof child === "number";

        if (!validChild) {
            throw new TypeError(
                "Component children must be components, strings, or numbers."
            );
        }

        this.children.push(child);

        return this;
    }
}
