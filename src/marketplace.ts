import { raiseForStatus } from "./errors.js";
import { VERSION } from "./version.js";
import type { ModelDetail, ModelListResponse } from "./types/model.js";
import type { ProviderDetail, ProviderListResponse } from "./types/provider.js";

const DEFAULT_TIMEOUT = 30_000;

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

export interface MarketplaceOptions {
  apiKey?: string | null;
  baseURL: string;
  timeout?: number;
}

export class MarketplaceModels {
  constructor(private readonly _opts: MarketplaceOptions) {}

  async list(params?: { limit?: number; offset?: number; q?: string }): Promise<ModelListResponse> {
    const search = new URLSearchParams();
    search.set("limit", String(params?.limit ?? 20));
    search.set("offset", String(params?.offset ?? 0));
    if (params?.q) search.set("q", params.q);

    const resp = await this._fetch(`/api/mkt/models?${search}`);
    return (await parseResponse(resp)) as ModelListResponse;
  }

  async get(modelId: string): Promise<ModelDetail> {
    const resp = await this._fetch(`/api/mkt/models/${encodePath(modelId)}`);
    let data = (await parseResponse(resp)) as Record<string, unknown>;
    if (data && typeof data === "object" && "data" in data) {
      data = data.data as Record<string, unknown>;
    }
    return data as unknown as ModelDetail;
  }

  private _fetch(path: string, init?: RequestInit): Promise<Response> {
    return fetchWithOpts(this._opts, path, init);
  }
}

export class MarketplaceProviders {
  constructor(private readonly _opts: MarketplaceOptions) {}

  async list(params?: { sort?: string; q?: string }): Promise<ProviderListResponse> {
    const search = new URLSearchParams();
    if (params?.sort) search.set("sort", params.sort);
    if (params?.q) search.set("q", params.q);

    const qs = search.toString();
    const resp = await this._fetch(`/api/mkt/providers${qs ? `?${qs}` : ""}`);
    return (await parseResponse(resp)) as ProviderListResponse;
  }

  async get(slug: string): Promise<ProviderDetail> {
    const resp = await this._fetch(`/api/mkt/provider/${encodePath(slug)}`);
    let data = (await parseResponse(resp)) as Record<string, unknown>;
    if (data && typeof data === "object" && "data" in data) {
      data = data.data as Record<string, unknown>;
    }
    return data as unknown as ProviderDetail;
  }

  private _fetch(path: string, init?: RequestInit): Promise<Response> {
    return fetchWithOpts(this._opts, path, init);
  }
}

export class Marketplace {
  readonly models: MarketplaceModels;
  readonly providers: MarketplaceProviders;

  constructor(opts: MarketplaceOptions) {
    this.models = new MarketplaceModels(opts);
    this.providers = new MarketplaceProviders(opts);
  }
}

function fetchWithOpts(opts: MarketplaceOptions, path: string, init?: RequestInit): Promise<Response> {
  const url = `${opts.baseURL.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "User-Agent": `onlist-js/${VERSION}`,
    Accept: "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (opts.apiKey) {
    headers["Authorization"] = `Bearer ${opts.apiKey}`;
  }
  const signal = AbortSignal.timeout(opts.timeout ?? DEFAULT_TIMEOUT);
  return fetch(url, { ...init, headers, signal });
}
