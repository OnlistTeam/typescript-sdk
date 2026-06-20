export interface MaxPrice {
  prompt?: number;
  completion?: number;
}

export interface ProviderRouting {
  only?: string[];
  sort?: "price" | "throughput";
  order?: string[];
  allow?: string[];
  ignore?: string[];
  allow_fallbacks?: boolean;
  max_price?: MaxPrice;
}
