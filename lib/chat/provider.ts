import { createOpenAI } from "@ai-sdk/openai";

export const TOKENROUTER_DEFAULT_BASE_URL = "https://api.tokenrouter.io/v1";
export const TOKENROUTER_DEFAULT_MODEL = "auto:balance";

export function tokenRouterConfigured(): boolean {
  return Boolean(process.env.TOKENROUTER_API_KEY);
}

/** Chat Completions model via TokenRouter's OpenAI-compatible gateway. */
export function getTokenRouterChatModel() {
  const apiKey = process.env.TOKENROUTER_API_KEY;
  if (!apiKey) return null;

  const provider = createOpenAI({
    apiKey,
    baseURL:
      process.env.TOKENROUTER_BASE_URL?.trim() || TOKENROUTER_DEFAULT_BASE_URL,
    name: "tokenrouter",
  });

  return provider.chat(
    process.env.TOKENROUTER_MODEL?.trim() || TOKENROUTER_DEFAULT_MODEL,
  );
}
