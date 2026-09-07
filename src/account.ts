/**
 * Account resources — the OpenRouter-compatible `/api/v1/*` face.
 *
 * Namespaces follow the wire path segments (`credits`, `generations`,
 * `apiKeys`, `activity`) and methods use a fixed verb set
 * (`list`/`get`/`create`/`update`/`delete`). Two departures, both forced:
 * `GET /api/v1/key` has no matching verb so it is `apiKeys.current()`, and
 * `/api/v1/auth/*` would read as client authentication config so the
 * namespace is `oauth`.
 *
 * Most of these endpoints require a **management key** (`mgmt_...`). The SDK
 * does not inspect key prefixes locally — it sends whatever credential it
 * was given and surfaces the server's 403 as `PermissionDeniedError`.
 */

import {
  encodePath,
  fetchWithRetry,
  jsonBody,
  parseResponse,
  type RequestOptions,
} from "./http.js";
import type {
  ActivityParams,
  ActivityRow,
  APIKey,
  CreatedKey,
  CreateKeyParams,
  Credits,
  CurrentKey,
  ExchangedKey,
  Generation,
  ListKeysParams,
  PkcePair,
  UpdateKeyParams,
} from "./types/account.js";

/** Options for creating the account resources. */
export type AccountOptions = RequestOptions;

/**
 * Unwrap the OpenRouter `{data: …}` envelope.
 *
 * Only used where the payload is entirely inside `data`. `POST /keys` and
 * `POST /auth/keys` carry fields alongside it and are parsed whole.
 */
function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate an S256 PKCE `{verifier, challenge}` pair.
 *
 * Send the challenge to `/auth` when starting the browser flow, keep the
 * verifier in memory, and pass it back to `oauth.exchange()`:
 *
 * ```typescript
 * const { verifier, challenge } = await generatePkce();
 * window.location.href =
 *   `https://onlist.io/auth?callback_url=${cb}` +
 *   `&code_challenge=${challenge}&code_challenge_method=S256`;
 * ```
 */
export async function generatePkce(): Promise<PkcePair> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const verifier = base64url(raw);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

const DEFAULT_BASE_URL = "https://onlist.io";

/**
 * Exchange a PKCE authorization code for an inference key, with no client.
 *
 * `client.oauth.exchange()` does the same thing, but constructing an
 * {@link Onlist} requires an API key — and an app running the "Sign in with
 * Onlist" flow does not have one yet. That is the entire point of the flow,
 * so it gets a credential-free entry point:
 *
 * ```typescript
 * const { verifier, challenge } = await generatePkce();
 * // ...user approves in the browser, your callback receives ?code=...
 * const result = await exchangeAuthCode(code, { codeVerifier: verifier });
 * const client = new Onlist({ apiKey: result.key });
 * ```
 *
 * Single-use: the code is consumed even when the verifier turns out to be
 * wrong, so a failure means restarting the browser flow.
 */
export async function exchangeAuthCode(
  code: string,
  opts?: { codeVerifier?: string; baseURL?: string; timeout?: number },
): Promise<ExchangedKey> {
  const resource = new AccountOAuth({
    baseURL: opts?.baseURL ?? DEFAULT_BASE_URL,
    timeout: opts?.timeout,
  });
  return resource.exchange(code, opts?.codeVerifier ?? "");
}

/** Account balance. Requires a management key. */
export class AccountCredits {
  constructor(private readonly _opts: AccountOptions) {}

  /** Get lifetime credits purchased and credits used, in USD. */
  async get(): Promise<Credits> {
    const resp = await fetchWithRetry(this._opts, "/api/v1/credits");
    return unwrap(await parseResponse(resp)) as Credits;
  }
}

/**
 * Per-call cost and timing.
 *
 * Accepts either credential type: an inference key can look up only the
 * calls it made, a management key any call on the account.
 */
export class AccountGenerations {
  constructor(private readonly _opts: AccountOptions) {}

  /**
   * Look up one call by request ID.
   *
   * @param requestId The value of the `X-Oneapi-Request-Id` response header
   *   from the original call.
   */
  async get(requestId: string): Promise<Generation> {
    const search = new URLSearchParams({ id: requestId });
    const resp = await fetchWithRetry(this._opts, `/api/v1/generation?${search}`);
    return unwrap(await parseResponse(resp)) as Generation;
  }
}

/**
 * Manage inference keys (`sk-...`). Requires a management key.
 *
 * The exception is {@link current}, which answers for whichever credential
 * made the request.
 */
export class AccountApiKeys {
  constructor(private readonly _opts: AccountOptions) {}

  /** Describe the credential this client is using. */
  async current(): Promise<CurrentKey> {
    const resp = await fetchWithRetry(this._opts, "/api/v1/key");
    return unwrap(await parseResponse(resp)) as CurrentKey;
  }

  /**
   * List inference keys.
   *
   * Pages are a fixed 100 keys and no total is returned: request
   * `offset += 100` until you get a short page.
   */
  async list(params?: ListKeysParams): Promise<APIKey[]> {
    const search = new URLSearchParams();
    search.set("offset", String(params?.offset ?? 0));
    search.set("include_disabled", String(params?.include_disabled ?? false));

    const resp = await fetchWithRetry(this._opts, `/api/v1/keys?${search}`);
    return (unwrap(await parseResponse(resp)) as APIKey[]) ?? [];
  }

  /**
   * Create an inference key.
   *
   * The plaintext secret is on `.key` of the result and is never retrievable
   * again.
   *
   * @param name Display name for the key. Required.
   */
  async create(name: string, params?: CreateKeyParams): Promise<CreatedKey> {
    const body: Record<string, unknown> = { name };
    if (params?.limit !== undefined) body.limit = params.limit;
    if (params?.limit_reset !== undefined) body.limit_reset = params.limit_reset;
    if (params?.expires_at !== undefined) body.expires_at = params.expires_at;

    const resp = await fetchWithRetry(this._opts, "/api/v1/keys", {
      method: "POST",
      ...jsonBody(body),
    });
    return (await parseResponse(resp)) as CreatedKey;
  }

  /** Get one inference key by its `hash`. */
  async get(hash: string): Promise<APIKey> {
    const resp = await fetchWithRetry(this._opts, `/api/v1/keys/${encodePath(hash)}`);
    return unwrap(await parseResponse(resp)) as APIKey;
  }

  /**
   * Update an inference key. Omitted fields are left unchanged.
   *
   * For `limit`, `limit_reset` and `expires_at`, passing `null` clears the
   * value; leaving the field out leaves it alone.
   */
  async update(hash: string, patch: UpdateKeyParams): Promise<APIKey> {
    // `!== undefined` rather than `in`: an explicit `undefined` means the
    // same thing as an absent field, and neither must reach the wire.
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.disabled !== undefined) body.disabled = patch.disabled;
    if (patch.limit !== undefined) body.limit = patch.limit;
    if (patch.limit_reset !== undefined) body.limit_reset = patch.limit_reset;
    if (patch.expires_at !== undefined) body.expires_at = patch.expires_at;

    const resp = await fetchWithRetry(this._opts, `/api/v1/keys/${encodePath(hash)}`, {
      method: "PATCH",
      ...jsonBody(body),
    });
    return unwrap(await parseResponse(resp)) as APIKey;
  }

  /** Delete an inference key. Resolves to `true` on success. */
  async delete(hash: string): Promise<boolean> {
    const resp = await fetchWithRetry(this._opts, `/api/v1/keys/${encodePath(hash)}`, {
      method: "DELETE",
    });
    const data = unwrap(await parseResponse(resp)) as { deleted?: boolean } | null;
    return Boolean(data?.deleted);
  }
}

/** Daily usage rollups. Requires a management key. */
export class AccountActivity {
  constructor(private readonly _opts: AccountOptions) {}

  /**
   * List usage grouped by day, model and provider.
   *
   * Covers the last 30 complete UTC days; today is excluded.
   */
  async list(params?: ActivityParams): Promise<ActivityRow[]> {
    const search = new URLSearchParams();
    if (params?.date) search.set("date", params.date);
    if (params?.api_key_hash) search.set("api_key_hash", params.api_key_hash);

    const qs = search.toString();
    const resp = await fetchWithRetry(this._opts, `/api/v1/activity${qs ? `?${qs}` : ""}`);
    return (unwrap(await parseResponse(resp)) as ActivityRow[]) ?? [];
  }
}

/**
 * Sign in with Onlist — the PKCE authorization-code exchange.
 *
 * Only the exchange lives here. The authorization step itself happens in the
 * user's browser at `https://onlist.io/auth`; there is no SDK call for it,
 * because the SDK has no session to authorize with.
 */
export class AccountOAuth {
  constructor(private readonly _opts: AccountOptions) {}

  /**
   * Exchange an authorization code for a new inference key.
   *
   * Unauthenticated, and single-use: the code is consumed even when the
   * verifier turns out to be wrong, so a failure means restarting the
   * browser flow.
   *
   * @param code The `code` query parameter from the callback URL.
   * @param codeVerifier The verifier from {@link generatePkce}. Required
   *   whenever the authorization request carried a challenge.
   */
  async exchange(code: string, codeVerifier = ""): Promise<ExchangedKey> {
    const resp = await fetchWithRetry(this._opts, "/api/v1/auth/keys", {
      method: "POST",
      ...jsonBody({ code, code_verifier: codeVerifier }),
    });
    return (await parseResponse(resp)) as ExchangedKey;
  }
}
