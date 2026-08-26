"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { getAnthropicClient, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { getContactTimeline } from "@/lib/timeline";
import { contactDisplayName } from "@/lib/types";

type AiResult = { text: string } | { error: string };

async function buildContactContext(contactId: string) {
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*, company:companies(name), owner:users(full_name, email)")
    .eq("id", contactId)
    .single();
  if (error || !contact) throw new Error("Contact not found");

  const events = await getContactTimeline(supabase, contactId);

  const header = [
    `Name: ${contactDisplayName(contact)}`,
    `Company: ${contact.company?.name ?? "Unknown"}`,
    `Job title: ${contact.job_title ?? "Unknown"}`,
    `Owner: ${contact.owner?.full_name ?? contact.owner?.email ?? "Unassigned"}`,
    `Lifecycle stage: ${contact.lifecycle_stage}`,
    `Lead score: ${contact.lead_score}`,
    `Source: ${contact.source ?? "Unknown"}`,
  ].join("\n");

  const timelineText = events
    .slice(0, 40)
    .map((e) => `- [${e.occurredAt}] ${e.title}${e.body ? `: ${e.body}` : ""}`)
    .join("\n");

  return `${header}\n\nRecent activity (most recent first):\n${timelineText || "No activity recorded yet."}`;
}

async function askClaude(contactId: string, prompt: string, maxTokens: number): Promise<AiResult> {
  await requireAppUser();

  const client = getAnthropicClient();
  if (!client) return { error: "AI features aren't configured yet — add ANTHROPIC_API_KEY to .env.local." };

  const context = await buildContactContext(contactId);

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: `${prompt}\n\n${context}` }],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return { text };
}

export async function summarizeContact(contactId: string): Promise<AiResult> {
  return askClaude(
    contactId,
    "You are a CRM assistant. Summarize this contact for a salesperson in 3-5 concise sentences, focused on who they are and where the relationship stands.",
    400,
  );
}

export async function suggestNextAction(contactId: string): Promise<AiResult> {
  return askClaude(
    contactId,
    "You are a CRM assistant. Based on this contact's info and recent activity, suggest ONE concrete next action a salesperson should take, with a one-sentence reason. Be specific and brief.",
    300,
  );
}
