import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4 for S3-compatible storage (Cloudflare R2), written out so no heavy SDK is needed. Two uses:
 * a presigned link the browser can PUT or GET with (the secret never leaves the server), and signed headers for the
 * server's own HEAD and GET calls. Pure functions: tests check them against the example in Amazon's documentation.
 */
export type SignInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  /** Host name, for example "<account>.r2.cloudflarestorage.com". */
  host: string;
  /** Path as it will be sent, already URL-encoded per segment, for example "/bucket/folder/file.pdf". */
  path: string;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** For a presigned link: seconds it stays valid (1 to 604800). */
  expiresIn?: number;
  now?: Date;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();

/** Encodes like AWS wants: everything except A-Z a-z 0-9 - _ . ~ ; a slash only stays when asked. */
export const awsEncode = (value: string, keepSlash = false): string =>
  [...value].map((char) => (/[A-Za-z0-9\-_.~]/.test(char) || (keepSlash && char === "/") ? char : encodeURIComponent(char).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))).join("");

/** The encoded path for a bucket and object key (path-style addressing). */
export const objectPath = (bucket: string, key: string): string => `/${awsEncode(bucket)}/${key.split("/").map((part) => awsEncode(part)).join("/")}`;

function stamps(now: Date) {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate: iso, date: iso.slice(0, 8) };
}

function signingKey(secret: string, date: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), "aws4_request");
}

/** A presigned URL: the signature lives in the query string, so a browser can use it with a plain fetch or XHR. */
export function presignUrl(input: SignInput): string {
  const service = input.service ?? "s3";
  const { amzDate, date } = stamps(input.now ?? new Date());
  const scope = `${date}/${input.region}/${service}/aws4_request`;
  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${input.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(input.expiresIn ?? 900)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const query = params.sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`).join("&");
  const canonical = [input.method, input.path, query, `host:${input.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signature = createHmac("sha256", signingKey(input.secretAccessKey, date, input.region, service)).update(stringToSign).digest("hex");
  return `https://${input.host}${input.path}?${query}&X-Amz-Signature=${signature}`;
}

/** Headers for a server-side call (HEAD, GET, DELETE) with no body. */
export function signHeaders(input: SignInput & { query?: string }): Record<string, string> {
  const service = input.service ?? "s3";
  const { amzDate, date } = stamps(input.now ?? new Date());
  const scope = `${date}/${input.region}/${service}/aws4_request`;
  const payloadHash = sha256("");
  const canonical = [input.method, input.path, input.query ?? "", `host:${input.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`, "host;x-amz-content-sha256;x-amz-date", payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signature = createHmac("sha256", signingKey(input.secretAccessKey, date, input.region, service)).update(stringToSign).digest("hex");
  return {
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
  };
}
