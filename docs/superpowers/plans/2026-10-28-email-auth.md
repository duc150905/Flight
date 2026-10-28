# Email authentication plan and progress

Goal: Real Supabase email/password registration, confirmation, sign-in, session
restoration and device-local sign-out in the Expo app with English UI.

Design: A signed-out user sees login/register. Registration collects name, email,
password and matching confirmation. A successful signup without a session opens
email verification. Confirmation uses an emailed numeric OTP (Supabase email
template must include `{{ .Token }}`), avoiding redirects from email to Expo Go.
Verification succeeds only when Supabase returns a session. Users can resend or
return to login and resume verification. Passwords are never stored by our code.
Supabase persists/refreshes sessions via AsyncStorage on native devices; auth
events determine the UI. Restoration has loading/error states. A failed network
restore offers retry, not an indefinite spinner. Sign-out affects this device.

Profile: name is display metadata in Supabase Auth for now, never an admin role.
Phone number is deferred to Profile/checkout; no phone field in registration.
No custom tables are needed for this milestone; profiles/RLS are a later feature.
No OAuth, password recovery or flight-booking screens in this milestone.

Implementation choices: blue/white accessible form, visible labels, inline field
errors, password visibility, busy/disabled buttons, keyboard-aware scroll layout.
Use the installed official supabase skill v0.1.2 and current Supabase Auth docs.
The design-system search's storytelling layout did not fit authentication;
use the React Native form/accessibility guidance instead.

## Tasks
- [x] Auth validation/error/service unit tests, observe red then implement.
  Files: src/features/auth/model.ts, tests/auth.test.mjs; npm test.
  Cover malformed email, mismatched passwords, unchanged passwords, normalized
  email, signup without session, verify without session, rejected credentials,
  resend and device-local logout boundary.
- [x] Supabase singleton and auth provider with persistence, auto refresh and
  lifecycle cleanup; session startup must not overwrite a newer sign-out event.
  Files: src/lib/supabase.ts, src/features/auth/session.ts, auth-provider.tsx.
- [x] Login/register/OTP UI, signed-in account screen and navigation root.
  Files: src/features/auth/auth-screen.tsx, account-screen.tsx, ui.tsx,
  src/app/_layout.tsx, index.tsx.
- [x] Email template and manual test instructions; update README and CI.
- [x] Run complete tests, lint/typecheck, web/Android exports; independent review.

## Verification limits
No real email is sent and no real user account is created during automated tests.
The account owner must apply the supplied email template and test delivery on
their device. Publishable key cannot change email templates or administer Auth.
Cloud template changes are not claimed complete without dashboard evidence.

## Progress
Environment baseline: 032feb2, clean; typecheck/lint passed.
Supabase skill installed at C:/Users/DUC/.codex/skills/supabase/SKILL.md.
Auth tests were run red before implementation; final suite: 17/17 passed.
TypeScript and ESLint passed. Platform exports passed (web and Android/Hermes).
Independent review found one P2: INITIAL_SESSION(null) suppressed a real startup
error. Regression reproduced red, fixed by letting getSession own startup; green.
No additional important findings. Native device/email acceptance remains pending.
Implementation choice: English UI per user's correction; contact phone deferred
to Profile/checkout to keep signup focused. No role taken from user metadata.
No cloud schema/template changes, account creation or email sending performed.
