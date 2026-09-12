"use client";

import Script from "next/script";

// Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so login/
// signup work unchanged until a real Cloudflare Turnstile site is created.
// Turnstile's implicit rendering auto-injects a hidden
// `cf-turnstile-response` input inside this div, which rides along in the
// enclosing form's FormData -- signIn()/signUp() (src/lib/actions/auth.ts)
// read it and pass it through as captchaToken. Also requires
// supabase/config.toml's [auth.captcha] to be enabled with a matching
// secret (see the comment there) -- until both sides are configured,
// Supabase Auth doesn't require or check a token at all.
export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
    </>
  );
}
