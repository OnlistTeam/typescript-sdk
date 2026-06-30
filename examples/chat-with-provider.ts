import { Onlist } from "@onlist/sdk";

const client = new Onlist();

const response = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Hello!" }],
  provider: {
    sort: "price",
    allow_fallbacks: true,
  },
});

console.log(response.choices[0].message.content);
