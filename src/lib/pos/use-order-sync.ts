"use client";

import { useCallback, useEffect, useState } from "react";
import { queuedCount } from "./db";
import { syncQueue } from "./sync";

const INTERVAL_MS = 20_000;

export type SyncState = {
  online: boolean;
  queued: number;
  syncing: boolean;
};

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
  const [online, setOnline] = useState(true);
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
    setOnline(navigator.onLine);
    void sync();

    const onOnline = () => {
      setOnline(true);
      void sync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const id = window.setInterval(() => {
      if (navigator.onLine) void sync();
      else void refresh();
    }, INTERVAL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(id);
    };
  }, [sync, refresh]);

  return { online, queued, syncing, refresh, sync };
}
