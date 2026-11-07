"use client";

import { ApiError, post } from "./api";

export type StoredResult = { id: string; status: string; note: string | null; summary: string | null; factsAdded: number; duplicate: boolean };

/**
 * Sends one file straight from the browser to the private file store, then tells the site it arrived. Returns null when the
 * file store is not set up, so the caller can fall back to the ordinary upload. The secret key never reaches the browser:
 * the site signs a short-lived link for this one file only.
 */
export async function uploadToStore(
  projectId: string,
  file: File,
  options: { ownership: string; onProgress: (percent: number) => void },
): Promise<StoredResult | null> {
  let signed: { key: string; url: string };
  try {
    signed = await post<{ key: string; url: string }>(`/api/contribute/projects/${projectId}/uploads/sign`, { filename: file.name, size: file.size, ownership: options.ownership, attested: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 501) return null;
    throw error;
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signed.url);
    if (file.type) request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`The file store refused the upload (${request.status}). Please try again.`)));
    request.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    request.ontimeout = () => reject(new Error("The upload took too long. Please try again."));
    request.send(file);
  });

  return post<StoredResult>(`/api/contribute/projects/${projectId}/uploads/register`, { key: signed.key, filename: file.name, type: file.type, ownership: options.ownership, attested: true });
}
