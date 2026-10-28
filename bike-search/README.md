# Bike Search

A browser-only motorcycle inventory browser hosted on GitHub Pages. No local server, account, proxy or private API credential is needed for supported live feeds.

## Use

Open Bike Search from the main project index. Select Olivers or TeamMoto showrooms and click **Fetch selected sources**. Downloads are manual; opening the page never starts a dealer inventory fetch. Keep the tab open until fetching finishes.

Each source is refreshed separately. Completed sources replace their own saved listings; failed or incomplete sources keep their previous listings while the remaining sources continue. TeamMoto pagination checks showroom filtering, duplicate results and completeness. Update showroom list discovers additional TeamMoto showrooms directly from its public search API.

## Browser storage

The first visit seeds browser local storage from data/state.json. Later visits read that cache. Fresh listings, source registry and filter selections are saved on this browser and device. Clearing site data restores the bundled snapshot on the next visit. Blocked or full storage permits browsing for the current visit, with a visible notice that changes cannot be saved. Photos load from dealer image hosts and are not cached by the app.

Filtering supports multiple brands, conditions and sources, inclusive price/kilometre ranges, search, sorting, pagination and filtered JSON export. Unknown numeric values remain null, while actual zero readings remain zero. Always check dealer links for current availability and exact pricing.

## Live source support

- Olivers: New, Used and Demo inventory from its public, browser-accessible stock feed. The public feed URL is configured in js/sources.js; update it if the dealer changes its stock configuration.
- TeamMoto: public Findify search API, using the storefront's public search key. Each showroom includes New, Used and Demo bikes. Requests contain transient random identifiers and no account credentials.
- Brisbane Motorcycles: saved listings only on GitHub Pages. The dealer does not return the cross-origin permission required for browser JavaScript to read its pages. Its refresh controls are disabled and explain the limitation. Changing this requires the dealer to allow browser requests, or a separately hosted fetching service. The existing local adapters remain available for development but are not used by the hosted app.

Dealer feeds and their browser permissions can change. Errors are shown without erasing the last good inventory.

## Development and verification

Serve the repository with any static web server. The browser app uses js/app.js, js/cache.js, js/sources.js and css/styles.css, with relative asset paths. It makes no /api requests.

Run npm install followed by npm test in this folder for cache, browser adapter and captured-source parser tests. Tests cover cache reopening, damaged/unavailable storage, feed normalization, showroom filters and truncated pagination.

The optional legacy Node server (npm start) and lib/sources.js are retained for development, including Brisbane retrieval; they are not required for GitHub Pages operation.
