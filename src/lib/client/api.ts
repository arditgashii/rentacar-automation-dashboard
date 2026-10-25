"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** fetch for the app's own API: JSON in and out, a readable error for anything but 2xx. */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401) {
    // The session expired: a full page load to the login page clears every client state.
    window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (!response.ok) throw new ApiError(data.error ?? `The server answered ${response.status}.`, response.status);
  return data as T;
}

/**
 * Loads a URL and keeps it fresh. With `pollMs` it refreshes in the background (without showing
 * the loading state again); a null URL loads nothing.
 */
export function useResource<T>(url: string | null, pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const latest = useRef(url);
  // A 404 will not fix itself, so polling stops for that URL.
  const gone = useRef(false);

  const load = useCallback(
    async (background = false) => {
      if (!url) return;
      latest.current = url;
      if (!background) setLoading(true);
      try {
        const result = await api<T>(url);
        if (latest.current === url) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) gone.current = true;
        if (latest.current === url && !background) setError((err as Error).message);
      } finally {
        if (latest.current === url && !background) setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    // Loading data on mount and whenever the URL changes is what this hook is for.
    gone.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    if (!pollMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !gone.current) void load(true);
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [load, pollMs]);

  return { data, error, loading, reload: () => load(), refresh: () => load(true), setData };
}
