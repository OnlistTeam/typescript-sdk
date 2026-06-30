/** Maximum price limits per token type (USD per million tokens). */
export interface MaxPrice {
  prompt?: number;
  completion?: number;
}

/** Provider routing configuration for the Onlist marketplace. */
export interface ProviderRouting {
  only?: string[];
  sort?: "price" | "throughput";
  order?: string[];
  allow?: string[];
  ignore?: string[];
  allow_fallbacks?: boolean;
  max_price?: MaxPrice;
}
