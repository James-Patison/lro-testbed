# lro-testbed

This repository is the default project for Codex chats working on `James-Patison/lro-testbed`.

Build static HTML items with JavaScript and CSS for GitHub Pages hosting.

Use the GitHub CLI (`gh`) first for GitHub operations. If the CLI is unavailable or fails, use the GitHub connection available to the chat. Ask the user for permission before using a cloud browser, and only consider one if the CLI cannot complete the operation.

In the current managed Codex workspace, Chromium browser tests fail with a crashpad `setsockopt: Operation not permitted` error. Use source checks and JavaScript-level tests there, and report that visual browser behavior remains unverified.
