import { raiseForStatus } from "./errors.js";
import { VERSION } from "./version.js";
import type { ModelDetail, ModelListResponse } from "./types/model.js";
import type { ProviderDetail, ProviderListResponse } from "./types/provider.js";
import type {
  ModelRankingsResponse,
  ModelRankingsParams,
  AppRankingsResponse,
  AppRankingsParams,
} from "./types/rankings.js";

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 500;
const MAX_RETRY_DELAY = 8_000;
const JITTER_FACTOR = 0.25;

/** Retryable status codes: timeouts, rate limits, and server errors. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function encodePath(segment: string): string {
  return segment
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

async function parseResponse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => "");
  }

  if (!response.ok) {
    raiseForStatus(response.status, body);
  }

  if (body && typeof body === "object" && "data" in body && "success" in body) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}

/** Calculates the retry delay with exponential backoff and jitter. */
function retryDelay(attempt: number, retryAfterHeader: string | null): number {
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

/** Options for creating a Marketplace client. */
export interface MarketplaceOptions {
  apiKey?: string | null;
  baseURL: string;
  timeout?: number;
  /** Maximum retry attempts for failed requests. Defaults to 2. */
  maxRetries?: number;
}

/** Access to marketplace model data. */
export class MarketplaceModels {
  constructor(private readonly _opts: MarketplaceOptions) {}

  /** List models in the marketplace catalog. */
  async list(params?: { limit?: number; offset?: number; q?: string }): Promise<ModelListResponse> {
    const search = new URLSearchParams();
    search.set("limit", String(params?.limit ?? 20));
    search.set("offset", String(params?.offset ?? 0));
    if (params?.q) search.set("q", params.q);

    const resp = await fetchWithRetry(this._opts, `/api/mkt/models?${search}`);
    return (await parseResponse(resp)) as ModelListResponse;
  }

  /** Get detailed info for a specific model, including provider offers. */
  async get(modelId: string): Promise<ModelDetail> {
    const resp = await fetchWithRetry(this._opts, `/api/mkt/models/${encodePath(modelId)}`);
    let data = (await parseResponse(resp)) as Record<string, unknown>;
    if (data && typeof data === "object" && "data" in data) {
      data = data.data as Record<string, unknown>;
    }
    return data as unknown as ModelDetail;
  }
}

/** Access to marketplace provider data. */
export class MarketplaceProviders {
  constructor(private readonly _opts: MarketplaceOptions) {}

  /** List providers on the marketplace. */
  async list(params?: { sort?: string; q?: string }): Promise<ProviderListResponse> {
    const search = new URLSearchParams();
    if (params?.sort) search.set("sort", params.sort);
    if (params?.q) search.set("q", params.q);

    const qs = search.toString();
    const resp = await fetchWithRetry(this._opts, `/api/mkt/providers${qs ? `?${qs}` : ""}`);
    return (await parseResponse(resp)) as ProviderListResponse;
  }

  /** Get detailed info for a specific provider. */
  async get(slug: string): Promise<ProviderDetail> {
    const resp = await fetchWithRetry(this._opts, `/api/mkt/provider/${encodePath(slug)}`);
    let data = (await parseResponse(resp)) as Record<string, unknown>;
    if (data && typeof data === "object" && "data" in data) {
      data = data.data as Record<string, unknown>;
    }
    return data as unknown as ProviderDetail;
  }
}

/** Access to marketplace rankings (models and apps). */
export class MarketplaceRankings {
  constructor(private readonly _opts: MarketplaceOptions) {}

  /** Get the model usage leaderboard and chart series. */
  async models(params?: ModelRankingsParams): Promise<ModelRankingsResponse> {
    const search = new URLSearchParams();
    if (params?.sort) search.set("sort", params.sort);
    if (params?.window) search.set("window", params.window);
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.offset != null) search.set("offset", String(params.offset));

    const qs = search.toString();
    const resp = await fetchWithRetry(this._opts, `/api/mkt/rankings/models${qs ? `?${qs}` : ""}`);
    return (await parseResponse(resp)) as ModelRankingsResponse;
  }

  /** Get the app rankings list. */
  async apps(params?: AppRankingsParams): Promise<AppRankingsResponse> {
    const search = new URLSearchParams();
    if (params?.sort) search.set("sort", params.sort);
    if (params?.window) search.set("window", params.window);
    if (params?.category) search.set("category", params.category);
    if (params?.subcategory) search.set("subcategory", params.subcategory);
    if (params?.page != null) search.set("page", String(params.page));
    if (params?.limit != null) search.set("limit", String(params.limit));

    const qs = search.toString();
    const resp = await fetchWithRetry(this._opts, `/api/mkt/apps${qs ? `?${qs}` : ""}`);
    return (await parseResponse(resp)) as AppRankingsResponse;
  }
}

/** Client for the Onlist marketplace public API. */
export class Marketplace {
  /** Browse and search models. */
  readonly models: MarketplaceModels;
  /** Browse and search providers. */
  readonly providers: MarketplaceProviders;
  /** Model and app usage rankings. */
  readonly rankings: MarketplaceRankings;

  constructor(opts: MarketplaceOptions) {
    this.models = new MarketplaceModels(opts);
    this.providers = new MarketplaceProviders(opts);
    this.rankings = new MarketplaceRankings(opts);
  }
}

function buildFetchInit(opts: MarketplaceOptions, init?: RequestInit): RequestInit {
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

async function fetchWithRetry(
  opts: MarketplaceOptions,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${opts.baseURL.replace(/\/$/, "")}${path}`;
  const fetchInit = buildFetchInit(opts, init);
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

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
