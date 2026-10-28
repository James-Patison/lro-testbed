# lro-testbed

This repository is the default project for Codex chats working on `James-Patison/lro-testbed`.

Build static HTML items with JavaScript and CSS for GitHub Pages hosting.

## Project structure

- Keep the root `index.html` as the central index of subprojects, and link each project from it.
- Give each project a dedicated folder at the repository root containing `index.html`, a `js/` folder for its JavaScript, and a `css/` folder for its CSS.
- Keep markup, behavior, and presentation in their respective HTML, JavaScript, and CSS files. Use clear, consistent names and formatting in the style of Microsoft web examples.
- Keep paths relative so GitHub Pages serves the site correctly from a repository subpath.
- Add new project conventions to this file and update `README.md` when the structure changes.
- Browser apps with client-side data may use `.mjs` modules in their `js/` folder and must keep all paths relative.

Use the approved GitHub connection for repository operations. The GitHub CLI (`gh`) is also fine when authenticated; it is not required.

For work on this repository, you may use the cloud browser for testing and push completed changes to the repository without asking for separate confirmation. Platform-enforced tool permissions and approvals still apply.

In the current managed Codex workspace, Chromium browser tests fail with a crashpad `setsockopt: Operation not permitted` error. Use source checks and JavaScript-level tests there, and report that visual browser behavior remains unverified.

Bike Search also includes a local Node server and adapters. Its Pages version uses a bundled snapshot under `data/` and browser local storage. Keep live dealer fetching in the local server.
