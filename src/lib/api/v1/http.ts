import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared plumbing for src/app/api/v1/** -- the general-purpose public REST
// API that website builders, form tools, Zapier/Make/n8n and custom code
// call with an org API key (Settings -> API Keys). Every route wraps its
// handler in withApi(), which handles CORS, key auth, per-key rate limiting
// and turning thrown ApiErrors into a consistent JSON error shape.

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.PUBLIC_API_RATE_LIMIT_PER_MINUTE) || 600;

export interface ApiContext {
  organizationId: string;
  apiKeyId: string;
  apiKeyName: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, "invalid_request", message, details);
export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);

// Browser-side callers (a site's own JS, embedded widgets) need CORS. The key
// itself is the credential, so any origin is allowed -- see the API docs on
// why keys should normally stay server-side.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key, Idempotency-Key",
  "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
  "Access-Control-Max-Age": "86400",
};

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Accepts the key the ways different tools can send it: a Bearer token
// (standard), an X-API-Key header (Make, many form tools), or an api_key
// query param (tools that can only configure a URL, e.g. plain form actions).
function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const [scheme, token] = auth.trim().split(/\s+/);
  if (scheme?.toLowerCase() === "bearer" && token) return token;
  const headerKey = req.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;
  return req.nextUrl.searchParams.get("api_key")?.trim() || null;
}

async function authenticate(req: NextRequest): Promise<{ ctx: ApiContext; rateHeaders: Record<string, string> }> {
  const key = extractApiKey(req);
  if (!key) throw new ApiError(401, "unauthorized", "Missing API key. Send it as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'.");

  const keyHash = createHash("sha256").update(key).digest("hex");
  const { data, error } = await createAdminClient().rpc("api_authenticate", {
    p_key_hash: keyHash,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (error) throw new ApiError(500, "internal_error", "Could not verify API key");

  const row = data?.[0];
  if (!row) throw new ApiError(401, "unauthorized", "Invalid or revoked API key");

  const resetSeconds = Math.ceil(new Date(row.window_reset_at).getTime() / 1000);
  const rateHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - row.request_count)),
    "X-RateLimit-Reset": String(resetSeconds),
  };
  if (row.request_count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(1, resetSeconds - Math.floor(Date.now() / 1000));
    throw Object.assign(new ApiError(429, "rate_limited", `Rate limit of ${RATE_LIMIT_MAX_REQUESTS} requests per minute exceeded`), {
      headers: { ...rateHeaders, "Retry-After": String(retryAfter) },
    });
  }

  return { ctx: { organizationId: row.organization_id, apiKeyId: row.api_key_id, apiKeyName: row.key_name }, rateHeaders };
}

function errorResponse(err: unknown, extraHeaders: Record<string, string>) {
  const apiErr =
    err instanceof ApiError ? err : (console.error("Public API v1 unhandled error", err), new ApiError(500, "internal_error", "Something went wrong"));
  const headers = { ...CORS_HEADERS, ...extraHeaders, ...((apiErr as ApiError & { headers?: Record<string, string> }).headers ?? {}) };
  return NextResponse.json(
    { error: { code: apiErr.code, message: apiErr.message, ...(apiErr.details !== undefined ? { details: apiErr.details } : {}) } },
    { status: apiErr.status, headers },
  );
}

export function withApi<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: ApiContext, params: P) => Promise<NextResponse>,
): (req: NextRequest, route: { params: Promise<P> }) => Promise<NextResponse> {
  return async (req, route) => {
    let rateHeaders: Record<string, string> = {};
    try {
      const auth = await authenticate(req);
      rateHeaders = auth.rateHeaders;
      const res = await handler(req, auth.ctx, await route.params);
      for (const [k, v] of Object.entries({ ...CORS_HEADERS, ...rateHeaders })) res.headers.set(k, v);
      return res;
    } catch (err) {
      return errorResponse(err, rateHeaders);
    }
  };
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

// Request bodies --------------------------------------------------------------

export interface ParsedBody {
  data: Record<string, unknown>;
  /** true for application/x-www-form-urlencoded and multipart/form-data (e.g. a plain HTML <form>). */
  isForm: boolean;
}

// JSON, urlencoded and multipart are all accepted so a raw HTML form, a
// form-builder webhook and a JSON client can hit the same endpoint. Repeated
// form keys (tags=a&tags=b) become arrays; File parts are ignored.
export async function parseBody(req: NextRequest): Promise<ParsedBody> {
  const type = req.headers.get("content-type")?.toLowerCase() ?? "";

  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw badRequest("Could not parse form body");
    }
    const data: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value !== "string") continue;
      const prev = data[key];
      data[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
    }
    return { data, isForm: true };
  }

  const text = await req.text();
  if (!text.trim()) return { data: {}, isForm: false };
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") throw new Error();
    return { data: parsed as Record<string, unknown>, isForm: false };
  } catch {
    throw badRequest("Request body must be valid JSON, application/x-www-form-urlencoded, or multipart/form-data");
  }
}

// After a successful plain-HTML form post, send the visitor somewhere useful
// instead of showing raw JSON. Only absolute http(s) URLs are honoured.
export function formRedirectTarget(req: NextRequest, body: Record<string, unknown>): string | null {
  const raw = (typeof body._redirect === "string" && body._redirect) || req.nextUrl.searchParams.get("redirect");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function redirect(url: string) {
  return NextResponse.redirect(url, 303);
}
