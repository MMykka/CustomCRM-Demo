export type IntegrationProvider = "twilio" | "resend" | "google_calendar" | "slack" | "meta";

export const INTEGRATION_PROVIDERS: {
  provider: IntegrationProvider;
  label: string;
  fields: { key: string; label: string }[];
}[] = [
  {
    provider: "twilio",
    label: "Twilio",
    fields: [
      { key: "account_sid", label: "Account SID" },
      { key: "auth_token", label: "Auth token" },
      { key: "from_number", label: "From number" },
    ],
  },
  {
    provider: "resend",
    label: "Resend",
    fields: [
      { key: "api_key", label: "API key" },
      { key: "sending_domain", label: "Sending domain" },
    ],
  },
  {
    provider: "google_calendar",
    label: "Google Calendar",
    fields: [{ key: "api_key", label: "API key" }],
  },
  {
    provider: "slack",
    label: "Slack",
    fields: [{ key: "webhook_url", label: "Incoming webhook URL" }],
  },
  {
    provider: "meta",
    label: "Meta",
    fields: [{ key: "access_token", label: "Access token" }],
  },
];

export function maskValue(value: string) {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
