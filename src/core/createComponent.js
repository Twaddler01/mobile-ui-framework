export default function createComponent(ComponentClass) {
    if (typeof ComponentClass !== "function") {
        throw new TypeError("createComponent requires a component class.");
    }

    return function componentFactory(props = {}, children = []) {
        return new ComponentClass(props, children);
    };
}
