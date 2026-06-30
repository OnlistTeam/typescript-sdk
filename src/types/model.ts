/** Model pricing in USD per million tokens. */
export interface Pricing {
  prompt: string;
  completion: string;
  request?: string | null;
}

/** Model architecture metadata. */
export interface Architecture {
  modality?: string | null;
  input_modalities?: string[] | null;
  output_modalities?: string[] | null;
  tokenizer?: string | null;
}

/** Top-provider context limits for a model. */
export interface TopProvider {
  context_length?: number | null;
  max_completion_tokens?: number | null;
  is_moderated?: boolean | null;
}

/** A model listed in the marketplace catalog. */
export interface Model {
  id: string;
  name?: string | null;
  author?: string | null;
  owned_by?: string | null;
  canonical_slug?: string | null;
  created?: number | null;
  description?: string | null;
  context_length?: number | null;
  max_output_length?: number | null;
  architecture?: Architecture | null;
  pricing?: Pricing | null;
  supported_parameters?: string[] | null;
  quantization?: string | null;
  top_provider?: TopProvider | null;
  is_ready?: boolean | null;
}

/** A provider's offer for a specific model. */
export interface ProviderOffer {
  listing_id?: number | null;
  provider_id?: number | null;
  slug?: string | null;
  name?: string | null;
  logo_url?: string | null;
  score?: number | null;
  price_input_usd?: string | null;
  price_output_usd?: string | null;
  availability_7d?: number | null;
}

/** Detailed model info including all provider offers. */
export interface ModelDetail {
  id: string;
  name?: string | null;
  author?: string | null;
  owned_by?: string | null;
  context_length?: number | null;
  max_output_length?: number | null;
  architecture?: Architecture | null;
  pricing?: Pricing | null;
  description?: string | null;
  providers: ProviderOffer[];
}

/** Paginated list of models. */
export interface ModelListResponse {
  data: Model[];
  total?: number | null;
  offset?: number | null;
  limit?: number | null;
}
