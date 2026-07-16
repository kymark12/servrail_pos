"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { queuedCount } from "./db";
import { syncQueue } from "./sync";

const INTERVAL_MS = 20_000;

export type SyncState = {
  online: boolean;
  queued: number;
  syncing: boolean;
};

// Online status is an external browser signal, so read it through
// useSyncExternalStore: no setState-in-effect, and SSR gets a stable `true`
// snapshot (navigator is undefined on the server).
function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Foreground sync driver for the till: flushes the queue on mount, on reconnect,
 * and on an interval while online; tracks online/queued/syncing for the header
 * indicator. `sync()` triggers an immediate flush (call it after a checkout);
 * `refresh()` just re-reads the queued count.
 */
export function useOrderSync(): SyncState & {
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
} {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setQueued(await queuedCount());
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncQueue();
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    // Initial flush, deferred one tick so the syncing flag doesn't toggle
    // synchronously during the effect (that would cascade a render on mount).
    const initial = window.setTimeout(() => void sync(), 0);

    // Flush the queue the moment we reconnect (the display value is handled by
    // useSyncExternalStore above; this listener only triggers the side-effect).
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);

    const id = window.setInterval(() => {
      if (navigator.onLine) void sync();
      else void refresh();
    }, INTERVAL_MS);

    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, [sync, refresh]);

  return { online, queued, syncing, refresh, sync };
}
