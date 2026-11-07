import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { keyBelongsTo, presignedPut, r2Config, storageKeyFor } from "./r2";

const env = { R2_ACCOUNT_ID: "acct123", R2_BUCKET: "futureskilz-sources", R2_ACCESS_KEY_ID: "AKID", R2_SECRET_ACCESS_KEY: "secret" };

describe("file store settings and keys", () => {
  it("is off unless all four settings are present", () => {
    expect(r2Config(env)).toMatchObject({ accountId: "acct123", bucket: "futureskilz-sources" });
    for (const name of Object.keys(env)) expect(r2Config({ ...env, [name]: " " }), name).toBeNull();
    expect(r2Config({})).toBeNull();
  });

  it("makes a key inside the project's folder, with a safe file name", () => {
    const key = storageKeyFor("proj-1", "../../etc/pass wd?.pdf");
    expect(key.startsWith("kc/proj-1/")).toBe(true);
    expect(key.split("/")).toHaveLength(4);
    expect(key).not.toContain("..");
    expect(storageKeyFor("proj-1", "a.pdf")).not.toBe(storageKeyFor("proj-1", "a.pdf"));
  });

  it("only accepts keys of the same project", () => {
    expect(keyBelongsTo("kc/proj-1/abc/file.pdf", "proj-1")).toBe(true);
    expect(keyBelongsTo("kc/proj-2/abc/file.pdf", "proj-1")).toBe(false);
    expect(keyBelongsTo("kc/proj-1/../proj-2/x.pdf", "proj-1")).toBe(false);
    expect(keyBelongsTo("other/proj-1/x.pdf", "proj-1")).toBe(false);
  });

  it("signs an upload link for the bucket's own address, valid for the time asked, without the secret in it", () => {
    const config = r2Config(env)!;
    const url = presignedPut(config, "kc/proj-1/abc/file.pdf", 1800);
    expect(url.startsWith("https://acct123.r2.cloudflarestorage.com/futureskilz-sources/kc/proj-1/abc/file.pdf?")).toBe(true);
    expect(url).toContain("X-Amz-Expires=1800");
    expect(url).toContain("X-Amz-Signature=");
    expect(url).not.toContain("secret");
  });
});
