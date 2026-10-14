export default class ScreenBase {
    constructor(context = {}) {
        if (
            context === null ||
            typeof context !== "object" ||
            Array.isArray(context)
        ) {
            throw new TypeError("Screen context must be an object.");
        }

        const prototype = Object.getPrototypeOf(context);

        if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError("Screen context must be a plain object.");
        }

        this.context = context;
    }

    render() {
        throw new Error(
            `${this.constructor.name}.render() must be implemented.`
        );
    }

    onEnter() {}

    onLeave() {}

    onDispose() {}
}
