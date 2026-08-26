import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// Mirrors n8n.ts's "isolated integration module" shape: one place that
// knows about the external API, returning null (rather than throwing) when
// unconfigured so callers can show a clear "add your API key" message.
export function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const ANTHROPIC_MODEL = "claude-sonnet-5";
