# Changelog

## 0.3.0 (2026-09-07)

### Added

- **Account API**: the OpenRouter-compatible `/api/v1/*` face, as five namespaces on the client.
  - `credits.get()` — account balance.
  - `apiKeys.current() / list() / create() / get() / update() / delete()` — inference key management. `create()` returns the plaintext secret once.
  - `generations.get(requestId)` — cost, tokens and latency for one call, keyed on the `X-Oneapi-Request-Id` response header.
  - `activity.list()` — daily usage by model and provider, last 30 complete UTC days.
  - `oauth.exchange()` — "Sign in with Onlist" PKCE authorization-code exchange.
- **managementKey**: new client option, plus the `ONLIST_MANAGEMENT_KEY` environment variable. Falls back to the API key, so a single-credential client still reaches the account endpoints.
- **generatePkce()**: exported helper returning an S256 `{ verifier, challenge }` pair.
- **exchangeAuthCode()**: standalone function for the OAuth exchange. `client.oauth.exchange()` does the same thing, but constructing `Onlist` requires an API key and an app running the sign-in flow does not have one yet.
- **Account types**: `APIKey`, `CurrentKey`, `CreatedKey`, `Credits`, `Generation`, `ActivityRow`, `ExchangedKey`, `RateLimit`, `PkcePair` and the parameter interfaces. Field names match the wire format one-for-one.
- **BadRequestError** (400) and **PermissionDeniedError** (403) error classes.

### Changed

- Retries are now limited to `GET`. Replaying `POST /api/v1/keys` would mint a second key and replaying the OAuth exchange would burn an already-consumed code; marketplace behaviour is unchanged, since it is all reads.
- The request loop, envelope parsing and retry policy moved to a shared internal `http` module. `MarketplaceOptions` is now an alias of the shared `RequestOptions` — structurally identical, no source change needed.

## 0.2.0 (2026-06-30)

### Added

- **Declaration merging**: `provider` field on `chat.completions.create()` now type-checks natively, no `@ts-expect-error` needed.
- **OPENAI_API_KEY fallback**: The client reads `OPENAI_API_KEY` if `ONLIST_API_KEY` is not set, matching the Python SDK.
- **Rankings API**: `marketplace.rankings.models()` and `marketplace.rankings.apps()` for accessing model and app usage leaderboards.
- **NotFoundError**: Dedicated error class for 404 responses from marketplace endpoints.
- **Marketplace retry**: Automatic retries with exponential backoff and jitter for transient failures (408, 429, 5xx). Configurable via `maxRetries`.
- **JSDoc**: All exported classes, interfaces, and methods now have documentation comments.

### Changed

- Removed `[key: string]: unknown` index signatures from `Model`, `ProviderOffer`, `ModelDetail`, and `Provider` interfaces. Runtime JSON still preserves unknown fields; this only affects TypeScript autocomplete.

## 0.1.0 (2026-06-20)

Initial release.
