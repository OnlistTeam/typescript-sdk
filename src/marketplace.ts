import {
  encodePath,
  fetchWithRetry,
  parseResponse,
  type RequestOptions,
} from "./http.js";
import type { ModelDetail, ModelListResponse } from "./types/model.js";
import type { ProviderDetail, ProviderListResponse } from "./types/provider.js";
import type {
  ModelRankingsResponse,
  ModelRankingsParams,
  AppRankingsResponse,
  AppRankingsParams,
} from "./types/rankings.js";

/** Options for creating a Marketplace client. */
export type MarketplaceOptions = RequestOptions;

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
