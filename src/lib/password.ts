// Mirrors the server-side policy in supabase/config.toml
// (auth.minimum_password_length / auth.password_requirements) so users get
// the same feedback in the browser before round-tripping to the server,
// which is the actual source of truth and rejects anything weaker.
export const PASSWORD_MIN_LENGTH = 10;

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must include a number";
  return null;
}
