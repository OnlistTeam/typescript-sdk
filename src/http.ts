import { raiseForStatus } from "./errors.js";
import { VERSION } from "./version.js";

export const DEFAULT_TIMEOUT = 30_000;
export const DEFAULT_MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 500;
const MAX_RETRY_DELAY = 8_000;
const JITTER_FACTOR = 0.25;

/** Retryable status codes: timeouts, rate limits, and server errors. */
export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Shared options for the REST resources (marketplace and account). */
export interface RequestOptions {
  apiKey?: string | null;
  baseURL: string;
  timeout?: number;
  /** Maximum retry attempts for failed requests. Defaults to 2. */
  maxRetries?: number;
}

export function encodePath(segment: string): string {
  return segment
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export async function parseResponse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => "");
  }

  if (!response.ok) {
    raiseForStatus(response.status, body);
  }

  // Only the marketplace envelope ({success, data}) is unwrapped here. The
  // account face uses OpenRouter's {data} without `success`, and POST /keys
  // returns {data, key} where the sibling field is the whole point —
  // unwrapping either one would silently drop data.
  if (body && typeof body === "object" && "data" in body && "success" in body) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}

/** Calculates the retry delay with exponential backoff and jitter. */
export function retryDelay(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY);
    }
  }
  const base = Math.min(INITIAL_RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY);
  const jitter = base * JITTER_FACTOR * (2 * Math.random() - 1);
  return Math.max(0, base + jitter);
}

export function buildFetchInit(opts: RequestOptions, init?: RequestInit): RequestInit {
  const headers: Record<string, string> = {
    "User-Agent": `onlist-js/${VERSION}`,
    Accept: "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (opts.apiKey) {
    headers["Authorization"] = `Bearer ${opts.apiKey}`;
  }
  const signal = AbortSignal.timeout(opts.timeout ?? DEFAULT_TIMEOUT);
  return { ...init, headers, signal };
}

export async function fetchWithRetry(
  opts: RequestOptions,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${opts.baseURL.replace(/\/$/, "")}${path}`;
  const fetchInit = buildFetchInit(opts, init);
  // Only idempotent GETs are replayed. A retried POST /api/v1/keys mints a
  // second key and a retried OAuth exchange burns the authorization code;
  // in both cases the caller ends up worse off than seeing the error.
  const method = (init?.method ?? "GET").toUpperCase();
  const maxRetries = method === "GET" ? opts.maxRetries ?? DEFAULT_MAX_RETRIES : 0;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchInit);
      if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === maxRetries) {
        return response;
      }
      const delay = retryDelay(attempt, response.headers.get("Retry-After"));
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      const delay = retryDelay(attempt, null);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** Serialise a JSON request body with the header fetch needs for it. */
export function jsonBody(value: unknown): RequestInit {
  return {
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" },
  };
}
