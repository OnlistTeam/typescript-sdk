/** A single entry in the model usage leaderboard. */
export interface ModelRanking {
  rank: number;
  model_name: string;
  author: string;
  author_icon: string | null;
  total_tokens: string;
  total_requests: number;
  growth_pct: number | null;
}

/** A single data point in the model usage chart series. */
export interface ModelSeriesPoint {
  bucket: string;
  value: number;
  type: string;
}

/** Response from GET /api/mkt/rankings/models. */
export interface ModelRankingsResponse {
  leaderboard: ModelRanking[];
  series: ModelSeriesPoint[];
  top_models: string[];
  sort: string;
  window: string;
  start_date: string;
  end_date: string;
}

/** Query parameters for the model rankings endpoint. */
export interface ModelRankingsParams {
  sort?: "popular" | "trending";
  window?: "day" | "week" | "month";
  limit?: number;
  offset?: number;
}

/** A single entry in the app rankings list. */
export interface AppRanking {
  app_id: number;
  url_key: string;
  slug: string | null;
  title: string;
  description: string | null;
  domain: string;
  icon_url: string | null;
  categories: string[];
  rank: number;
  total_requests: number;
  total_tokens: string;
  growth_pct: number | null;
}

/** Response from GET /api/mkt/apps. */
export interface AppRankingsResponse {
  apps: AppRanking[];
  page: number;
  limit: number;
  has_more: boolean;
  sort: string;
  window: string;
  start_date: string;
  end_date: string;
}

/** Query parameters for the app rankings endpoint. */
export interface AppRankingsParams {
  sort?: "popular" | "trending";
  window?: "day" | "week" | "month";
  category?: string;
  subcategory?: string;
  page?: number;
  limit?: number;
}
