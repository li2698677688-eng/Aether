"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/config";

const STORAGE_KEY = "designfeed:favorites";
const CHANGE_EVENT = "designfeed:favorites-change";

function parseFavoriteIds(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function useFavorites(initialFavorites: string[] = []) {
  const router = useRouter();
  const [remote] = useState(isSupabaseConfigured);
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));

  useEffect(() => {
    const controller = new AbortController();
    if (remote) {
      void fetch("/api/me/favorites", { signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ ids: string[] }> : null)
        .then((body) => {
          if (body && !controller.signal.aborted) setFavorites(new Set(body.ids));
        })
        .catch(() => undefined);
      return () => controller.abort();
    }

    const syncLocal = () => setFavorites(new Set(parseFavoriteIds(window.localStorage.getItem(STORAGE_KEY))));
    syncLocal();
    window.addEventListener("storage", syncLocal);
    window.addEventListener(CHANGE_EVENT, syncLocal);
    return () => {
      window.removeEventListener("storage", syncLocal);
      window.removeEventListener(CHANGE_EVENT, syncLocal);
    };
  }, [remote]);

  function toggleFavorite(siteId: string) {
    const wasFavorite = favorites.has(siteId);
    const next = new Set(favorites);
    if (wasFavorite) next.delete(siteId);
    else next.add(siteId);
    setFavorites(next);

    if (!remote) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return;
    }

    void fetch(`/api/sites/${encodeURIComponent(siteId)}/favorite`, { method: wasFavorite ? "DELETE" : "POST" })
      .then((response) => {
        if (response.ok) return;
        setFavorites(new Set(favorites));
        if (response.status === 401) {
          const nextPath = `${window.location.pathname}${window.location.search}`;
          router.push(`/login?next=${encodeURIComponent(nextPath)}`);
        }
      })
      .catch(() => setFavorites(new Set(favorites)));
  }

  return { favorites, toggleFavorite };
}
