const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const sessionDrafts = new Map<string, string | null>();

export const createModalDraftStore = <T,>(key: string | null) => {
  const discard = () => {
    if (!key) return;
    sessionDrafts.set(key, null);
    try { window.localStorage.removeItem(key); } catch { /* Discard still wins in this session. */ }
  };
  return {
    read: (): T | null => {
      if (!key) return null;
      try {
        let raw = sessionDrafts.get(key);
        if (!sessionDrafts.has(key)) {
          try { raw = window.localStorage.getItem(key); } catch { /* Session fallback. */ }
        }
        if (!raw) return null;
        const stored = JSON.parse(raw);
        if (!stored || !Number.isFinite(stored.savedAt) || Date.now() - stored.savedAt > MAX_AGE_MS || !stored.data || typeof stored.data !== 'object') {
          discard();
          return null;
        }
        return stored.data as T;
      } catch { discard(); return null; }
    },
    save: (data: T): boolean => {
      if (!key) return false;
      const raw = JSON.stringify({ savedAt: Date.now(), data });
      sessionDrafts.set(key, raw);
      try { window.localStorage.setItem(key, raw); return true; } catch { return false; }
    },
    discard,
  };
};
