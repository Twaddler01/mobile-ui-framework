// src/debug/debugTests.js
console.log("registerSuite...");

const devConsole = window.devConsole;

if (devConsole?.tests?.registerSuite) {
    devConsole.tests.registerSuite({
        id: "mobile-ui-framework",
        name: "Mobile UI Framework",
        description: "Debug options",

        actions: [
            {
                id: "forward",
                label: "Navigation: FORWARD",
                description: "demo.navigator.forward()",
                run: () => window.demo.navigator.forward()
            },
            {
                id: "screenhosttest",
                label: "screenhosttest",
                description: "screenhosttest",
                run: () => {
                    const host = document.querySelector("#screen-host");
                    
                    console.log(
                    host.dataset.canGoBack, // "false"
                    window.demo.navigator.navigate("Details"),
                    host.dataset.canGoBack, // "true"
                    window.demo.navigator.back(),
                    host.dataset.canGoForward // "true"
                    );
                }
            },
            {
                id: "sample-logs",
                label: "Write Sample Logs",
                description: "Adds log, warning, and object output to LOG.",

                run: ({ console }) => {
                    console.log("Demo integration connected.");
                    console.warn(
                        "This is a sample warning from a registered action."
                    );

                    console.log("Sample data:", {
                        project: "demo-project",
                        registered: true,
                        timestamp: new Date().toISOString()
                    });
                }
            },
            {
                id: "registry-summary",
                label: "Inspect Registered Suites",
                description:
                    "Returns the currently registered suite names and actions.",
                run: ({ console }) => console.tests.getSuites()
            },
            {
                id: "async-demo",
                label: "Run Async Example",
                description: "Demonstrates an action that returns a promise.",

                run: async () => ({
                    result: "Async action completed",
                    completedAt: new Date().toISOString()
                })
            }
        ]
    });

    console.log("Mobile UI Framework suite registered.");
} else {
    console.warn(
        "mobile-ui-framework integration API is unavailable.",
        devConsole
    );
}
