# lro-testbed

This repository is the default project for Codex chats working on `James-Patison/lro-testbed`.

Build static HTML items with JavaScript and CSS for GitHub Pages hosting.

## Project structure

- Keep the root `index.html` as the central index of subprojects, and link each project from it.
- Give each project a dedicated folder at the repository root containing `index.html`, a `js/` folder for its JavaScript, and a `css/` folder for its CSS.
- Keep markup, behavior, and presentation in their respective HTML, JavaScript, and CSS files. Use clear, consistent names and formatting in the style of Microsoft web examples.
- Keep paths relative so GitHub Pages serves the site correctly from a repository subpath.
- Add new project conventions to this file and update `README.md` when the structure changes.

Use the approved GitHub connection for repository operations. The GitHub CLI (`gh`) is also fine when authenticated; it is not required. Ask the user for permission before using a cloud browser.

In the current managed Codex workspace, Chromium browser tests fail with a crashpad `setsockopt: Operation not permitted` error. Use source checks and JavaScript-level tests there, and report that visual browser behavior remains unverified.
