// Gives the jsdom test environment a working IndexedDB so Dexie (src/lib/pos/db.ts)
// runs exactly as it does in the browser. `/auto` installs indexedDB + IDBKeyRange
// on the global scope.
import "fake-indexeddb/auto";
