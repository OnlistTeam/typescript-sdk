# Changelog

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
