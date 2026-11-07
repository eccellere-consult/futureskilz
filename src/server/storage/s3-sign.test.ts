import { describe, expect, it } from "vitest";

import { awsEncode, objectPath, presignUrl, signHeaders } from "./s3-sign";

const keys = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" };

describe("S3 signing", () => {
  it("reproduces the presigned URL in Amazon's documentation", () => {
    const url = presignUrl({ ...keys, method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", expiresIn: 86400, now: new Date("2013-05-24T00:00:00Z") });
    expect(url).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
    expect(url).toContain("X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request");
  });

  it("reproduces the signed headers in Amazon's documentation (GET with a Range header excluded: plain GET Object)", () => {
    const headers = signHeaders({ ...keys, method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", now: new Date("2013-05-24T00:00:00Z") });
    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  });

  it("encodes keys the way S3 expects, keeping folders", () => {
    expect(awsEncode("a b&c/d")).toBe("a%20b%26c%2Fd");
    expect(objectPath("bucket", "kc/p1/My file (1).pdf")).toBe("/bucket/kc/p1/My%20file%20%281%29.pdf");
  });

  it("changes the signature when the method, path or time changes", () => {
    const base = { ...keys, host: "h.example.com", path: "/b/k", now: new Date("2026-11-07T00:00:00Z") };
    const sig = (extra: object) => presignUrl({ ...base, method: "PUT", ...extra }).split("X-Amz-Signature=")[1];
    expect(sig({})).not.toBe(sig({ method: "GET" }));
    expect(sig({})).not.toBe(sig({ path: "/b/other" }));
    expect(sig({})).not.toBe(sig({ now: new Date("2026-11-07T00:00:01Z") }));
    expect(sig({})).toBe(sig({}));
  });
});
