export const MERGE_FIELDS = [
  { token: "{{contact.first_name}}", label: "Contact first name" },
  { token: "{{contact.last_name}}", label: "Contact last name" },
  { token: "{{contact.email}}", label: "Contact email" },
  { token: "{{contact.company}}", label: "Contact's company" },
  { token: "{{user.full_name}}", label: "Your name" },
  { token: "{{organization.name}}", label: "Organization name" },
] as const;

const SAMPLE_VALUES: Record<string, string> = {
  "{{contact.first_name}}": "Jordan",
  "{{contact.last_name}}": "Blake",
  "{{contact.email}}": "jordan@acme.com",
  "{{contact.company}}": "Acme Co",
  "{{user.full_name}}": "You",
  "{{organization.name}}": "Your organization",
};

export function renderMergeFields(template: string) {
  return MERGE_FIELDS.reduce((text, field) => text.replaceAll(field.token, SAMPLE_VALUES[field.token]), template);
}
