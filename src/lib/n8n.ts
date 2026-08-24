import "server-only";

// Fires the "deal moved to a new stage" event to n8n so a workflow there
// can react (e.g. send an email, post to Slack). Best-effort: a failure
// here must never block the stage change itself, so callers should not
// await this on the critical path of the user-facing action.
export async function notifyDealStageChanged(payload: {
  dealId: string;
  organizationId: string;
  pipelineId: string;
  fromStageId: string | null;
  toStageId: string;
}) {
  const webhookUrl = process.env.N8N_DEAL_STAGE_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "deal.stage_changed", ...payload }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Failed to notify n8n of deal stage change", error);
  }
}
