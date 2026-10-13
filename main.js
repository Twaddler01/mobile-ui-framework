
const workspaceContent = document.querySelector(
    "#workspace-content"
);

function renderLandingWorkspace() {
    workspaceContent.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon" aria-hidden="true">＋</div>

            <h3>Your workspace is ready</h3>

            <p>
                This is the starting point for your UI framework.
                Create your first example to test the workspace.
            </p>

            <button
                id="create-example"
                class="primary-button"
                type="button"
            >
                Create Example
            </button>
        </div>
    `;

    document
        .querySelector("#create-example")
        .addEventListener("click", renderExample);
}

function renderExample() {
    workspaceContent.innerHTML = `
        <article class="example-card">
            <h3>Hello, workspace!</h3>

            <p>
                Your application is running with plain HTML,
                CSS, and JavaScript. No Phaser scene is required.
            </p>

            <button
                id="back-to-workspace"
                class="primary-button"
                type="button"
            >
                Back to Workspace
            </button>
        </article>
    `;

    document
        .querySelector("#back-to-workspace")
        .addEventListener("click", renderLandingWorkspace);
}

function startApplication() {
    renderLandingWorkspace();

    console.log("Mobile UI Framework started.");
}

startApplication();
