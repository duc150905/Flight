# Flyora authentication UI — 2026-11-03

- Shared auth palette uses teal (`#007E91` for readable white-button text) and
  pale teal backgrounds. The existing top Flyora logo is the only logo; no
  additional logo is placed next to the welcome heading.
- Password fields use cross-platform eye/eye-off symbols with translated
  show/hide accessibility labels and at least a 44-point target. They change
  only `secureTextEntry`, not the field value; disabled fields disable toggles.
- Google sign-in uses the existing OAuth handler with an official bundled
  Google G glyph on a white outlined button. Busy/disabled behavior remains.
- Forgot password is a text action directly below the login password field,
  right aligned, and preserves the entered email when opening recovery.
- The login screen no longer shows an unconditional Confirm email button.
  After `email_not_confirmed`, it offers the existing verification form for
  the exact attempted email. Editing to another email hides that action.
  Entering this form does not silently send another email; Resend remains an
  explicit rate-limited action.
- Successful registration without a session still opens the verification form
  automatically; server session issuance and OTP validation are unchanged.

No Supabase settings, session persistence, SMTP settings, passwords, RLS or
verification requirements are changed by this UI update.
