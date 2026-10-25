"use client";

import { useCallback, useEffect, useState } from "react";

/** Small fetch helpers for the capture screens. Errors carry the server's plain-language message. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.", response.status, data);
  return data as T;
}

export const post = <T,>(url: string, body?: unknown): Promise<T> => api<T>(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T,>(url: string, body: unknown): Promise<T> => api<T>(url, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T,>(url: string, body: unknown): Promise<T> => api<T>(url, { method: "PUT", body: JSON.stringify(body) });

export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : "Something went wrong. Please try again.");

export function formatDuration(seconds: number): string {
  if (seconds < 90) return `${seconds} sec`;
  return `${Math.round(seconds / 60)} min`;
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Loads JSON from a URL and keeps it; `reload` fetches again (after a change), `setError` shows a problem from an action. */
export function useRemote<T>(url: string): { data: T | null; error: string | null; setError: (message: string | null) => void; reload: () => void; setData: (value: T) => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    api<T>(url)
      .then((value) => {
        if (active) {
          setData(value);
          setError(null);
        }
      })
      .catch((caught) => {
        if (active) setError(messageOf(caught));
      });
    return () => {
      active = false;
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, setError, reload, setData };
}
