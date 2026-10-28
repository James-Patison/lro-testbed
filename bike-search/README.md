# Bike Search

A local jQuery inventory browser combining multiple motorcycle dealers into a shared card and JSON format.

## Run

Requires Node.js 20.18.1 or newer. In this folder:

```powershell
npm install
npm start
```

Then open http://127.0.0.1:8080. Use Ctrl+C to stop the server. The browser must use the local server; opening index.html directly will not work.

## Sources and scope

- Brisbane Motorcycles used: only cards explicitly labelled Windsor.
- Brisbane Motorcycles new: all new catalogue models, labelled Showroom unconfirmed. These are catalogue entries, not a guarantee of showroom stock. Missing kilometres and engine capacity remain null.
- Olivers Motorcycles: the Moorooka inventory, including New, Used and Demo.
- TeamMoto: a separate selectable source for each showroom in the public inventory search. Each showroom fetch includes its New, Used and Demo bikes. Update showroom list checks for additional showroom names; it does not download bike inventories.

sources.json contains the local source registry. lib/sources.js contains the source adapters and shared normalisation. TeamMoto uses its storefront's public Findify search key, and Olivers uses the inventory endpoint configured on its public stock page. No account or private API credentials are needed. These are website feeds and can change; adapter errors are shown without replacing the previous good cache.

## Manual fetching and caches

Opening the app reads local files only for inventory. It never starts a new inventory download automatically. Tick the desired sources/showrooms and click Fetch selected sources. A progress job reads each selected source in turn. Each completed source is saved independently and atomically; a failure retains that source's last good cache and the remaining selected sources continue.

Cache files are under cache/:

- brisbane-used-windsor.json
- brisbane-new.json
- olivers.json
- teammoto-<showroom>.json (one per fetched showroom)

Unchecked sources are not fetched or overwritten. Fetch checkboxes control downloads, while Display source filters the combined saved results. Source selections are remembered in this browser. Original bikes-cache.json is migrated once to the Windsor cache without deleting the original file. Existing test.html, test.js and exported JSON files are preserved.

Photos are referenced by their source URLs and lazy-loaded into cards when available; image bytes are not cached locally. Missing or failed photos show a placeholder. Thus inventory browsing is cached, but photos still need a connection to the dealer's image host.

## Filters and export

Brand options are generated from all cached bikes, with case normalisation across feeds. Price and kilometre ranges are inclusive. Unknown values are excluded only when their range is set. Conditions are New, Used/pre-owned, Demo and Unspecified. Search matches name, brand and stock number. Sorting and Show more affect presentation only. Export filtered JSON includes every matching item, even those beyond the currently displayed cards.

Each bike has: id, sourceId, dealer, showroom (nullable), name, brand, condition, stockNumber, priceAud, priceNote, odometerKm, engineCapacityCc, url, imageUrl and listingNote. Missing numeric values are null, while actual zero readings remain zero. Listed prices are preserved with source qualifiers where available; consult the bike page for exact rideaway or on-road pricing.

## Local API

- GET /api/state: registry, all saved snapshots, cache errors and current/last job.
- GET /api/cache/<sourceId>: one cached snapshot, or null if never fetched.
- POST /api/fetch with JSON {"sourceIds":["olivers","teammoto-virginia"]}: starts a selected-source job.
- GET /api/job: progress and per-source results.
- POST /api/showrooms with {}: manually discovers additional TeamMoto showrooms.

POST requests require application/json and a local-page Origin header. The server only listens on 127.0.0.1:8080. While a fetch is running it rejects another fetch to prevent overlapping writes. If the page closes during a fetch, the server finishes the job; reopening reconnects to its progress.

## Verification

Run npm test for captured-source parser tests. Tests cover Windsor-only filtering, unconfirmed new catalogue locations, missing readings versus zero, brand and condition mapping, pagination links and per-bike links/photos. Browser checks additionally exercise live source fetches, separate cache files, cached reopening without a new fetch, combined filters and responsive layouts.

## Saved selections and multi-select filters

Brand, condition and display-source dropdowns support multiple checkbox selections. Selected options within one filter use OR; separate filters use AND. Clearing a dropdown includes all values. Sort order remains one choice: Name, Price low-to-high, Price high-to-low, or Kilometres low-to-high. Missing prices always appear last, including descending price order.

Fetch-source checkboxes, search text, brand/condition/source selections, price and kilometre bounds, and sort order are automatically saved to user-selections.json in this project folder. The page loads this file before applying filters. It is shared by browsers using this local server; the latest edited selections are used on the next page load. Source checkboxes from the former browser-local setting are imported on first load when no selections file exists. Clear filters is also saved, while leaving fetch-source checkboxes intact.

GET /api/preferences reads the saved selections (null before the first save). POST /api/preferences validates and atomically saves the complete selection object. Selection saves work while an inventory fetch is running. No selection change triggers an inventory download. Filter arrays in JSON exports are named brands, conditions and sourceIds.

## GitHub Pages

The hosted version browses the bundled inventory snapshot in data/state.json. Filtering, sorting and JSON export work; selections are saved in browser local storage. Live dealer fetching and showroom discovery require the local Node server. The snapshot is historical; check dealer links for availability and current prices. JavaScript and CSS live under js/ and css/.
