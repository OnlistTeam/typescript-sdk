/**
 * Account API: balance, key management, per-call costs, and daily usage.
 *
 * Everything except `generations.get()` needs a management key (`mgmt_...`),
 * which you create at https://onlist.io/management-keys. Set it as
 * ONLIST_MANAGEMENT_KEY or pass it explicitly, as below.
 *
 * Run: npx tsx examples/account.ts
 */

import { Onlist, PermissionDeniedError, exchangeAuthCode, generatePkce } from "@onlist/sdk";

const client = new Onlist({ apiKey: "sk-...", managementKey: "mgmt_..." });

// --- Balance ---------------------------------------------------------------
const credits = await client.credits.get();
console.log(`balance: $${(credits.total_credits - credits.total_usage).toFixed(4)} USD`);

// --- Which credential am I holding? ----------------------------------------
const me = await client.apiKeys.current();
console.log(`credential: ${me.label} (management=${me.is_management_key})`);

// --- Manage inference keys -------------------------------------------------
const created = await client.apiKeys.create("ci-runner", { limit: 5, limit_reset: "daily" });
// `created.key` is the only time you will ever see the plaintext secret.
console.log(`created ${created.data.hash}: ${created.key}`);

// Omitted fields are left alone; `null` clears the value.
await client.apiKeys.update(created.data.hash, { limit: null }); // drop the spend cap
await client.apiKeys.update(created.data.hash, { disabled: true }); // stop it spending

// Pages are a fixed 100 with no total — read until you get a short page.
for (let offset = 0; ; offset += 100) {
  const page = await client.apiKeys.list({ offset, include_disabled: true });
  for (const key of page) {
    console.log(`  ${key.hash.padStart(6)}  ${key.name}  $${key.usage.toFixed(4)} used`);
  }
  if (page.length < 100) break;
}

await client.apiKeys.delete(created.data.hash);

// --- What did one call cost? ----------------------------------------------
const { data: completion, response } = await client.chat.completions
  .create({
    model: "deepseek/deepseek-chat",
    messages: [{ role: "user", content: "Hello!" }],
  })
  .withResponse();

const requestId = response.headers.get("X-Oneapi-Request-Id");
if (requestId) {
  const gen = await client.generations.get(requestId);
  console.log(`${gen.model} via ${gen.provider_name}: $${gen.total_cost.toFixed(6)}`);
  console.log(`  ${gen.tokens_prompt} in / ${gen.tokens_completion} out, ${gen.latency}ms to first token`);
}
console.log(completion.choices[0]?.message.content);

// --- Daily usage rollups ---------------------------------------------------
// Last 30 complete UTC days; today is excluded because it is still moving.
for (const row of await client.activity.list()) {
  console.log(`${row.date}  ${row.model}  ${row.requests} req  $${row.usage.toFixed(4)}`);
}

// --- Sign in with Onlist (PKCE) -------------------------------------------
// Sketch: in a real app the user approves in a browser and your callback
// receives ?code=... The exchange itself needs no credential.
const { verifier, challenge } = await generatePkce();
const authUrl =
  "https://onlist.io/auth" +
  "?callback_url=http://localhost:8976/callback" +
  `&code_challenge=${challenge}&code_challenge_method=S256`;
console.log(`open: ${authUrl}`);

// `exchangeAuthCode` is standalone because an app running this flow has no
// API key yet, and constructing `Onlist` requires one.
const code = process.argv[2] ?? ""; // the ?code=... value from your callback
const exchanged = await exchangeAuthCode(code, { codeVerifier: verifier });
console.log(`user key: ${exchanged.key}`);

// --- What an inference key gets on the account face ------------------------
const buyer = new Onlist({ apiKey: "sk-..." }); // no management key
try {
  await buyer.credits.get();
} catch (e) {
  if (e instanceof PermissionDeniedError) console.log(`403: ${e.message}`);
}
