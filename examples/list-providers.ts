import { Onlist } from "@onlist/sdk";

const client = new Onlist();

const providers = await client.marketplace.providers.list();

for (const provider of providers.items) {
  console.log(`${provider.name} (${provider.slug})`);
  console.log(`  Models: ${provider.listing_count}`);
  console.log(`  Score: ${provider.weighted_score}`);
}
