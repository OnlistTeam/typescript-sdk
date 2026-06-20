import { Onlist } from "onlist";

const client = new Onlist();

const models = await client.marketplace.models.list({ limit: 10 });

console.log(`Total models: ${models.total}`);
for (const model of models.data) {
  const price = model.pricing;
  console.log(`  ${model.id}: $${price?.prompt}/M input, $${price?.completion}/M output`);
}
