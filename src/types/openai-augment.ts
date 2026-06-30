import type { ProviderRouting } from "./routing.js";

declare module "openai/resources/chat/completions/completions" {
  interface ChatCompletionCreateParamsBase {
    /** Onlist provider routing configuration. */
    provider?: ProviderRouting;
  }
}
