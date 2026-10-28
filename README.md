# lro-testbed

Static browser projects hosted from the repository root with GitHub Pages.

## Structure

- `index.html` is the central project index. Its styles live in `css/`.
- Each project has a folder at the root with its own `index.html`, `css/`, and `js/` folders.
- `todo/` is a task tracker.
- `expense-splitter/` is Common Ground, a group expense splitter. It saves people, groups, categories, expenses, and payments in browser local storage. Data stays on the device and is not shared across browsers or users.

## Local development

Serve the repository root with any static web server and open `index.html`. The apps use browser local storage to save their data.

- `bike-search/` is a motorcycle inventory browser. GitHub Pages seeds browser local storage from `data/state.json` on first visit and reuses the cached inventory on later visits; filters and export work in the browser, with preferences saved on the device. Olivers and TeamMoto refresh directly from the browser; Brisbane remains saved-only because the dealer blocks browser requests (see its README).
