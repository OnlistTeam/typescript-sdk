/**
 * Response types for the account API (`/api/v1/*`).
 *
 * Field names mirror the wire format one-for-one, which is OpenRouter's, so
 * code written against OpenRouter's responses reads the same fields here.
 */

/**
 * The deprecated per-key rate limit descriptor on {@link CurrentKey}.
 *
 * Onlist has no per-key request-rate limit — only spend budgets — so
 * `requests` is always `-1`. Do not use it to drive client-side throttling.
 */
export interface RateLimit {
  requests: number;
  interval: string;
  note: string;
}

/**
 * An inference key (`sk-...`) as returned by the `apiKeys` resource.
 *
 * `limit`, `limit_remaining` and `limit_reset` move together: either all
 * three are set, or all three are `null` (no spend budget). Amounts are USD.
 * `created_at` / `expires_at` are RFC 3339 UTC strings, or `null` for
 * "never".
 */
export interface APIKey {
  hash: string;
  name: string;
  label: string;
  disabled: boolean;
  limit: number | null;
  limit_remaining: number | null;
  limit_reset: string | null;
  include_byok_in_limit: boolean;
  usage: number;
  usage_daily: number;
  usage_weekly: number;
  usage_monthly: number;
  byok_usage: number;
  byok_usage_daily: number;
  byok_usage_weekly: number;
  byok_usage_monthly: number;
  created_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
  external_user: string | null;
  creator_user_id: string | null;
  workspace_id: string | null;
}

/**
 * The credential used for the request, from `apiKeys.current()`.
 *
 * Every field is optional because the endpoint answers for both credential
 * types and they carry different information: a management key has no usage
 * and no budget (reporting `0` would read as "an inference key that has
 * never spent"), so those fields are simply absent from its projection.
 * Branch on `is_management_key`.
 */
export interface CurrentKey extends Partial<APIKey> {
  is_free_tier?: boolean;
  is_management_key?: boolean;
  is_provisioning_key?: boolean;
  rate_limit?: RateLimit;
}

/**
 * The result of `apiKeys.create()`.
 *
 * `key` is the full secret in plaintext and is returned **only here, only
 * once** — the server keeps a hash. Store it before discarding this object.
 * `data` is the same key object later reads return.
 */
export interface CreatedKey {
  key: string;
  data: APIKey;
}

/** Parameters for `apiKeys.create()`. */
export interface CreateKeyParams {
  /** Spend budget in USD. Omit for no budget. */
  limit?: number;
  /** `"daily"`, `"weekly"`, or omitted for a lifetime total. `"monthly"` is rejected. */
  limit_reset?: string;
  /** Expiry as a Unix timestamp. Omit to never expire. */
  expires_at?: number;
}

/**
 * Patch for `apiKeys.update()`.
 *
 * Three states: an omitted (or `undefined`) field is left unchanged, and an
 * explicit `null` clears the value. `name` and `disabled` therefore accept
 * no `null` — the server reads `{"name": null}` as an empty name (400) and
 * `{"disabled": null}` as `false`, which would silently re-enable a key you
 * only meant to leave alone.
 */
export interface UpdateKeyParams {
  name?: string;
  disabled?: boolean;
  limit?: number | null;
  limit_reset?: string | null;
  expires_at?: number | null;
}

/** Parameters for `apiKeys.list()`. */
export interface ListKeysParams {
  /** Number of keys to skip. Pages are a fixed 100 and no total is returned. */
  offset?: number;
  /** Include disabled keys in the result. */
  include_disabled?: boolean;
}

/**
 * Account balance, in USD.
 *
 * Remaining balance is `total_credits - total_usage`: the endpoint reports
 * lifetime totals rather than a single "balance" number, matching
 * OpenRouter.
 */
export interface Credits {
  total_credits: number;
  total_usage: number;
}

/**
 * Cost and timing for a single completed call, from `generations.get()`.
 *
 * Fields Onlist has no data for are `null` rather than `0`: `upstream_id`,
 * `http_referer`, `user_agent`, `origin`, `api_type`, `cache_discount` and
 * `native_tokens_reasoning`. For reconciliation, "not measured" and
 * "measured as zero" are different statements.
 *
 * `latency` is time-to-first-token in milliseconds and is `null` for
 * non-streamed calls, which never measure it. `generation_time` is total
 * wall time in milliseconds. `total_cost` and `usage` are the same USD
 * amount under both of OpenRouter's names.
 */
export interface Generation {
  id: string;
  model: string;
  provider_name: string | null;
  streamed: boolean;
  latency: number | null;
  generation_time: number;
  created_at: string | null;
  tokens_prompt: number;
  tokens_completion: number;
  native_tokens_prompt: number;
  native_tokens_completion: number;
  native_tokens_cached: number | null;
  native_tokens_reasoning: number | null;
  total_cost: number;
  usage: number;
  cache_discount: number | null;
  finish_reason: string | null;
  native_finish_reason: string | null;
  is_byok: boolean;
  upstream_id: string | null;
  http_referer: string | null;
  user_agent: string | null;
  origin: string | null;
  api_type: string | null;
}

/**
 * One day × model × provider bucket from `activity.list()`.
 *
 * `date` is a `YYYY-MM-DD` UTC day and `usage` is USD. Only complete days
 * appear — today is still accumulating, and this endpoint exists for
 * reconciliation.
 */
export interface ActivityRow {
  date: string;
  model: string;
  model_permaslug: string;
  endpoint_id: string;
  provider_name: string | null;
  usage: number;
  byok_usage_inference: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
}

/** Parameters for `activity.list()`. */
export interface ActivityParams {
  /** Restrict to one `YYYY-MM-DD` UTC day inside the 30-day window. */
  date?: string;
  /** Restrict to one inference key. A hash from another account yields an empty list. */
  api_key_hash?: string;
}

/**
 * The result of `oauth.exchange()`.
 *
 * `key` is a new inference key in plaintext, returned once. `user_id` is
 * always `null` on Onlist: on OpenRouter it carries the calling
 * application's own external user identifier, which Onlist has no concept
 * of.
 */
export interface ExchangedKey {
  key: string;
  user_id: string | null;
}

/** An S256 PKCE pair from `generatePkce()`. */
export interface PkcePair {
  /** Kept in memory and passed back to `oauth.exchange()`. */
  verifier: string;
  /** Sent to `/auth` when opening the browser flow. */
  challenge: string;
}
