/** A provider (seller) on the marketplace. */
export interface Provider {
  id?: number | null;
  slug: string;
  name?: string | null;
  display_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  listing_count?: number | null;
  follower_count?: number | null;
  weighted_score?: number | null;
  sample_count?: number | null;
  max_rpm?: number | null;
  availability_7d?: number | null;
}

/** Detailed provider info including their listings. */
export interface ProviderDetail extends Provider {
  listings: Record<string, unknown>[];
}

/** Paginated list of providers. */
export interface ProviderListResponse {
  items: Provider[];
}
