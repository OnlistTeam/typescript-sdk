import { Onlist } from "@onlist/sdk";

const client = new Onlist();

const stream = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "Tell me a short story about a cat." }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}

console.log();
