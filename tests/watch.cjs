// watch-test.js
const fs = require("fs");
const path = require("path");

const directory = path.resolve(process.argv[2] || ".");

console.log("Watching:", directory);

try {
    const watcher = fs.watch(
        directory,
        { recursive: true },
        (eventType, filename) => {
            console.log(
                new Date().toLocaleTimeString(),
                eventType,
                filename?.toString()
            );
        }
    );

    console.log("Watcher started. Modify a file to test events.");

    process.on("SIGINT", () => {
        watcher.close();
        process.exit(0);
    });
} catch (error) {
    console.error("Watcher failed:", error.message);
}