import { Onlist } from "onlist";

const client = new Onlist();

const response = await client.chat.completions.create({
  model: "anthropic/claude-sonnet-4",
  messages: [{ role: "user", content: "What is the meaning of life?" }],
});

console.log(response.choices[0].message.content);
