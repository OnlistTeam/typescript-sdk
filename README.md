# Onlist JavaScript/TypeScript SDK

The official JavaScript/TypeScript SDK for [Onlist](https://onlist.io), the AI API marketplace. Access 200+ AI models through a unified, OpenAI-compatible API with intelligent provider routing and competitive pricing.

## Installation

```bash
npm install onlist
```

## Quick Start

```typescript
import { Onlist } from "onlist";

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

// From environment variable
// export ONLIST_API_KEY=sk-...
const client = new Onlist();
```

## Provider Routing

Route requests to specific providers on the Onlist marketplace:

```typescript
// Pin to a specific provider
const response = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Hello!" }],
  // @ts-expect-error -- extra body fields
  provider: { only: ["alice-shop"] },
});

// Sort by price
const response = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
  // @ts-expect-error
  provider: { sort: "price" },
});

// Prioritize specific providers with fallback
const response = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
  // @ts-expect-error
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

## Error Handling

OpenAI-compatible calls (`chat.completions`, `embeddings`, etc.) throw standard `openai` errors. Marketplace calls throw `onlist` errors:

```typescript
import OpenAI from "openai";
import { AuthenticationError } from "onlist";

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
  await client.marketplace.models.list();
} catch (e) {
  if (e instanceof AuthenticationError) {
    console.log("Invalid API key for marketplace");
  }
}
```

## Migration from OpenAI

Replace the `openai` import with `onlist`:

```diff
- import OpenAI from "openai";
+ import { Onlist } from "onlist";

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
+ import { Onlist } from "onlist";

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
import type { Model, Provider, ProviderRouting } from "onlist";
```

## Links

- [Website](https://onlist.io)
- [Documentation](https://onlist.io/docs)
- [Model Catalog](https://onlist.io/models)
- [Provider Directory](https://onlist.io/providers)
- [API Reference](https://onlist.io/docs/api)
- [GitHub](https://github.com/OnlistTeam/onlist-js)
- [Python SDK](https://pypi.org/project/onlist/)

## License

MIT
