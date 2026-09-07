# Onlist JavaScript/TypeScript SDK

The official JavaScript/TypeScript SDK for [Onlist](https://onlist.io), the AI API marketplace. Access 200+ AI models through a unified, OpenAI-compatible API with intelligent provider routing and competitive pricing.

## Installation

```bash
npm install @onlist/sdk
```

## Quick Start

```typescript
import { Onlist } from "@onlist/sdk";

const client = new Onlist({ apiKey: "sk-..." });

const response = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
```

## Authentication

The SDK looks for API keys in this order:

1. `apiKey` constructor parameter
2. `ONLIST_API_KEY` environment variable
3. `OPENAI_API_KEY` environment variable (OpenAI SDK fallback)

```typescript
// Explicit key
const client = new Onlist({ apiKey: "sk-..." });

// From ONLIST_API_KEY
// export ONLIST_API_KEY=sk-...
const client = new Onlist();

// Falls back to OPENAI_API_KEY if ONLIST_API_KEY is not set
// export OPENAI_API_KEY=sk-...
const client = new Onlist();
```

For the [Account API](#account-api) there is a second, optional credential —
a management key, read from the `managementKey` parameter or
`ONLIST_MANAGEMENT_KEY`, falling back to your API key:

```typescript
const client = new Onlist({ managementKey: "mgmt_..." });
// export ONLIST_MANAGEMENT_KEY=mgmt_...
```

## Provider Routing

Route requests to specific providers on the Onlist marketplace:

```typescript
// Pin to a specific provider
const response = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Hello!" }],
  provider: { only: ["alice-shop"] },
});

// Sort by price
const response = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
  provider: { sort: "price" },
});

// Prioritize specific providers with fallback
const response = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
  provider: {
    order: ["alice-shop", "bob-ai"],
    allow_fallbacks: true,
  },
});
```

## Streaming

```typescript
const stream = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Tell me a story" }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
```

## Marketplace API

Browse models and providers on the Onlist marketplace:

```typescript
// List models with pricing
const models = await client.marketplace.models.list({ limit: 10 });
console.log(`Found ${models.total} models`);
for (const model of models.data) {
  console.log(`${model.id}: $${model.pricing?.prompt}/M tokens`);
}

// Search models
const results = await client.marketplace.models.list({ q: "claude" });

// Get detailed model info with all provider offers
const detail = await client.marketplace.models.get("anthropic/claude-sonnet-4");
for (const offer of detail.providers) {
  console.log(`${offer.name}: $${offer.price_input_usd}/M input`);
}

// List providers
const providers = await client.marketplace.providers.list();
for (const provider of providers.items) {
  console.log(`${provider.name} (${provider.listing_count} models)`);
}

// Get provider profile
const profile = await client.marketplace.providers.get("alice-shop");
```

## Rankings API

Access model and app usage rankings:

```typescript
// Model usage leaderboard
const rankings = await client.marketplace.rankings.models({
  sort: "popular",
  window: "week",
});
for (const entry of rankings.leaderboard) {
  console.log(`#${entry.rank} ${entry.model_name} (${entry.total_requests} requests)`);
}

// Trending models
const trending = await client.marketplace.rankings.models({
  sort: "trending",
  window: "month",
});

// App rankings
const apps = await client.marketplace.rankings.apps({
  sort: "popular",
  window: "month",
  limit: 10,
});
for (const app of apps.apps) {
  console.log(`#${app.rank} ${app.title} (${app.domain})`);
}
```

## Account API

Balance, API key management, per-call costs and daily usage. These endpoints
are OpenRouter-compatible: same paths, same field names.

Most of them need a **management key** (`mgmt_...`), which you create at
[onlist.io/management-keys](https://onlist.io/management-keys). It is a
separate credential from your inference key and cannot make model calls:

```typescript
const client = new Onlist({ apiKey: "sk-...", managementKey: "mgmt_..." });
// or set ONLIST_API_KEY and ONLIST_MANAGEMENT_KEY
```

If you pass only `apiKey`, it is used for the account endpoints too. That
matches OpenRouter's single-keyhole shape, and the server returns
`PermissionDeniedError` where a management key is actually required.

### Credits

```typescript
const credits = await client.credits.get();
console.log(`$${(credits.total_credits - credits.total_usage).toFixed(4)} remaining`);
```

### API keys

```typescript
// Create — `.key` is the plaintext secret, returned exactly once
const created = await client.apiKeys.create("ci-runner", { limit: 5, limit_reset: "daily" });
console.log(created.key);

// List — fixed pages of 100, no total; read until you get a short page
const keys = await client.apiKeys.list({ offset: 0, include_disabled: true });

// Read one
const key = await client.apiKeys.get(created.data.hash);

// Update — omitted fields are left unchanged, `null` clears the value
await client.apiKeys.update(key.hash, { limit: null }); // remove the spend cap
await client.apiKeys.update(key.hash, { disabled: true }); // stop it spending

await client.apiKeys.delete(key.hash);

// Describe the credential this client is holding
const me = await client.apiKeys.current();
```

`update()` distinguishes three states. An omitted (or `undefined`) field is
left alone; an explicit `null` clears the value. Because of that, `name` and
`disabled` do not accept `null` at all — the server reads `{"name": null}` as
an empty name and `{"disabled": null}` as `false`, which would re-enable a
key you only meant to leave alone.

`limit_reset` accepts `"daily"`, `"weekly"`, or `null` for a lifetime total.

### Generation

What one call cost, and where it went. This one also accepts a plain
inference key, which can look up the calls it made itself:

```typescript
const { data, response } = await client.chat.completions
  .create({ model: "deepseek/deepseek-chat", messages: [{ role: "user", content: "Hi" }] })
  .withResponse();

const gen = await client.generations.get(response.headers.get("X-Oneapi-Request-Id")!);
console.log(`${gen.provider_name}: $${gen.total_cost}, ${gen.latency}ms to first token`);
```

### Activity

Daily usage grouped by model and provider, covering the last 30 complete UTC
days. Today is excluded, so the same query always returns the same numbers:

```typescript
for (const row of await client.activity.list()) {
  console.log(`${row.date} ${row.model} ${row.requests} req $${row.usage}`);
}

// Narrow to one day or one key
await client.activity.list({ date: "2026-09-05" });
await client.activity.list({ api_key_hash: "42" });
```

## Sign in with Onlist

Let your users authorize your app and get their own inference key, without
ever pasting one. This is the OAuth PKCE flow, compatible with OpenRouter's:

```typescript
import { Onlist, exchangeAuthCode, generatePkce } from "@onlist/sdk";

const { verifier, challenge } = await generatePkce();

window.location.href =
  "https://onlist.io/auth" +
  "?callback_url=https://yourapp.com/callback" +
  `&code_challenge=${challenge}&code_challenge_method=S256`;

// ...user approves, your callback receives ?code=...

const result = await exchangeAuthCode(code, { codeVerifier: verifier });
const client = new Onlist({ apiKey: result.key }); // scoped to that user
```

`exchangeAuthCode()` is a standalone function, not a client method, because
an app running this flow has no API key yet — that is the whole point of it —
and constructing `Onlist` requires one. If you already have a client,
`client.oauth.exchange()` does the same thing.

The code is single-use and is consumed even when the verifier does not match,
so a failed exchange means restarting the browser flow.

## Error Handling
OpenAI-compatible calls (`chat.completions`, `embeddings`, etc.) throw standard `openai` errors. Marketplace calls throw `onlist` errors:

```typescript
import OpenAI from "openai";
import { AuthenticationError, NotFoundError } from "@onlist/sdk";

// OpenAI-compatible endpoints throw openai errors
try {
  await client.chat.completions.create({ model: "gpt-4o", messages: [] });
} catch (e) {
  if (e instanceof OpenAI.AuthenticationError) {
    console.log("Invalid API key");
  }
}

// Marketplace endpoints throw onlist errors
try {
  await client.marketplace.models.get("nonexistent/model");
} catch (e) {
  if (e instanceof NotFoundError) {
    console.log("Model not found");
  }
  if (e instanceof AuthenticationError) {
    console.log("Invalid API key for marketplace");
  }
}
```

Account endpoints throw the same family, plus `BadRequestError` (400) and
`PermissionDeniedError` (403). The server's message is passed through
unchanged:

```typescript
import { PermissionDeniedError } from "@onlist/sdk";

try {
  await client.credits.get();
} catch (e) {
  if (e instanceof PermissionDeniedError) {
    console.log(e.message); // "Only management keys can perform this operation"
  }
}
```

## Retry Configuration

Marketplace and account API calls automatically retry on transient failures (408, 429, 5xx) with exponential backoff:

```typescript
const client = new Onlist({
  apiKey: "sk-...",
  maxRetries: 3, // default: 2
});
```

Only `GET` requests are retried. Creating a key or exchanging an
authorization code is never replayed: a duplicate key or a burnt code is
worse than surfacing the transient error.

## Migration from OpenAI

Replace the `openai` import with `onlist`:

```diff
- import OpenAI from "openai";
+ import { Onlist } from "@onlist/sdk";

- const client = new OpenAI({ apiKey: "sk-..." });
+ const client = new Onlist({ apiKey: "sk-..." });

// All existing code works unchanged
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Migration from OpenRouter

```diff
- import OpenAI from "openai";
+ import { Onlist } from "@onlist/sdk";

- const client = new OpenAI({
-   baseURL: "https://openrouter.ai/api/v1",
-   apiKey: process.env.OPENROUTER_API_KEY,
- });
+ const client = new Onlist();

// Provider routing syntax is compatible
const response = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## TypeScript

The SDK is written in TypeScript and ships with full type definitions. All marketplace response types are exported:

```typescript
import type {
  Model,
  Provider,
  ProviderRouting,
  ModelRankingsResponse,
  AppRankingsResponse,
} from "@onlist/sdk";
```

## Links

- [Website](https://onlist.io)
- [Documentation](https://onlist.io/docs)
- [Model Catalog](https://onlist.io/models)
- [Provider Directory](https://onlist.io/providers)
- [API Reference](https://onlist.io/docs/api)
- [GitHub](https://github.com/OnlistTeam/typescript-sdk)
- [Python SDK](https://pypi.org/project/onlist/)

## License

MIT
