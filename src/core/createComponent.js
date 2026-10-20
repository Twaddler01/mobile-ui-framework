export default function createComponent(ComponentClass, options = {}) {
    if (typeof ComponentClass !== "function") {
        throw new TypeError("createComponent requires a component class.");
    }

    const contentFirst = options.contentFirst === true;

    return function componentFactory(first = {}, second = []) {
        if (
            contentFirst &&
            (typeof first === "string" || typeof first === "number")
        ) {
            return new ComponentClass(second, [first]);
        }
        return new ComponentClass(first, second);
    };
}