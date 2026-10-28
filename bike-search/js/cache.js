'use strict';
(function (root) {
  const key = 'bike-search-inventory-v1';
  function valid(state) {
    return state && Array.isArray(state.sources) && Array.isArray(state.snapshots) &&
      state.snapshots.every(snapshot => snapshot && Array.isArray(snapshot.bikes));
  }
  async function load(storage, fetchState) {
    try {
      const saved = JSON.parse(storage.getItem(key));
      if (valid(saved)) return { state: saved, cached: true, saved: true };
    } catch { /* Unavailable or damaged storage falls back to the bundled inventory. */ }
    const state = await fetchState();
    if (!valid(state)) throw new Error('Invalid inventory snapshot');
    const inventory = { sources: state.sources, snapshots: state.snapshots, errors: [], job: null };
    let saved = false;
    try { storage.setItem(key, JSON.stringify(inventory)); saved = true; } catch { /* Browsing still works if storage is full or blocked. */ }
    return { state: inventory, cached: false, saved };
  }
  const api = { load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.bikeSearchCache = api;
})(globalThis);
