// ./debug/DebugButtons.js

export class DebugButtons {
    static devTools = null;
    static buttons = new Map();
    static unregisterSuite = null;
    static lastGoodButtons = null;

    static connect(devTools) {
        if (!devTools || typeof devTools.registerSuite !== "function") {
            throw new TypeError("A valid DevTools instance is required.");
        }

        this.unregisterSuite?.();
        this.unregisterSuite = null;
        this.devTools = devTools;

        this.publish();
    }

    static register({ id, label, description = "", run } = {}) {
        if (
            typeof id !== "string" ||
            !id.trim() ||
            typeof label !== "string" ||
            !label.trim() ||
            typeof description !== "string" ||
            typeof run !== "function"
        ) {
            throw new TypeError(
                "A debug button requires a non-empty id, " +
                    "a non-empty label, a description string, and run()."
            );
        }

        if (this.buttons.has(id)) {
            throw new Error(`Debug button "${id}" already exists.`);
        }

        const button = { id, label, description, run };

        this.buttons.set(id, button);

        try {
            this.publish();
        } catch (error) {
            this.buttons.delete(id);
            throw error;
        }

        let registered = true;

        return () => {
            if (!registered) return;
            registered = false;

            // Don't accidentally remove a newer button with the same ID.
            if (this.buttons.get(id) !== button) return;

            this.buttons.delete(id);

            try {
                this.publish();
            } catch (error) {
                console.error(
                    `Failed to update debug buttons after removing "${id}".`,
                    error
                );
            }
        };
    }

    static publish() {
        if (!this.devTools) return;

        const currentButtons = [...this.buttons.values()];

        // Preserve the last successfully published version.
        const previousButtons = this.lastGoodButtons;

        // Remove the old suite before registering its replacement.
        this.unregisterSuite?.();
        this.unregisterSuite = null;

        if (currentButtons.length === 0) {
            this.lastGoodButtons = [];
            return;
        }

        try {
            this.unregisterSuite = this.devTools.registerSuite({
                id: "project-debug-buttons",
                name: "Project Debug Buttons",
                description: "Debug actions registered by project modules.",
                actions: currentButtons.map(button => ({
                    id: button.id,
                    label: button.label,
                    description: button.description,
                    run: button.run
                }))
            });

            // The new suite registered successfully.
            this.lastGoodButtons = currentButtons;
        } catch (error) {
            console.error("Failed to publish debug buttons:", error);

            // Restore the last working suite if one exists.
            if (previousButtons?.length) {
                try {
                    this.unregisterSuite = this.devTools.registerSuite({
                        id: "project-debug-buttons",
                        name: "Project Debug Buttons",
                        description:
                            "Project debug actions (previous working version).",
                        actions: previousButtons.map(button => ({
                            id: button.id,
                            label: button.label,
                            description: button.description,
                            run: button.run
                        }))
                    });
                } catch (fallbackError) {
                    this.unregisterSuite = null;

                    console.error(
                        "Failed to restore the previous debug button suite:",
                        fallbackError
                    );
                }
            }

            throw error;
        }
    }
}

export default class DebugButton {
    constructor(options) {
        this.unregister = DebugButtons.register(options);
    }

    destroy() {
        this.unregister?.();
        this.unregister = null;
    }
}
