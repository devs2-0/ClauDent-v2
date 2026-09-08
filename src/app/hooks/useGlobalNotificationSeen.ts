import { useCallback, useEffect, useMemo, useState } from "react";

const REMINDER_INTERVAL_MS = 12 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_PREFIX = "claudent.global-notifications.seen";

type SeenNotifications = Record<string, number>;

const readSeenNotifications = (storageKey: string): SeenNotifications => {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) return {};

    const parsedValue = JSON.parse(storedValue) as unknown;
    if (!parsedValue || typeof parsedValue !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsedValue).filter(
        ([, value]) => typeof value === "number" && Number.isFinite(value),
      ),
    );
  } catch {
    return {};
  }
};

export const useGlobalNotificationSeen = (userId?: string | null) => {
  const storageKey = `${STORAGE_PREFIX}.${userId || "anonymous"}`;
  const [seenNotifications, setSeenNotifications] = useState<SeenNotifications>(() =>
    readSeenNotifications(storageKey),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSeenNotifications(readSeenNotifications(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  const markSeen = useCallback((notificationId: string) => {
    setSeenNotifications((current) => {
      const next = { ...current, [notificationId]: Date.now() };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // El aviso sigue disponible durante esta sesión aunque el navegador bloquee el almacenamiento.
      }
      return next;
    });
    setNow(Date.now());
  }, [storageKey]);

  const recentlySeenIds = useMemo(
    () => new Set(
      Object.entries(seenNotifications)
        .filter(([, seenAt]) => now - seenAt < REMINDER_INTERVAL_MS)
        .map(([notificationId]) => notificationId),
    ),
    [now, seenNotifications],
  );

  return {
    isRecentlySeen: (notificationId: string) => recentlySeenIds.has(notificationId),
    markSeen,
  };
};
