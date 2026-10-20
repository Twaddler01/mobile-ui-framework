
/**
 * Shared console setup for framework demos and workspace pages.
 *
 * console-loader.js in mobile-dev-console initializes the console.
 * This module registers the framework's test suites.
 */

// Reuse the existing console initialization.
await import("../../../mobile-dev-console/console-loader.js");

// Register framework test suites after console initialization.
await import("./debugTests.js");

console.info("Framework test suites registered.");
