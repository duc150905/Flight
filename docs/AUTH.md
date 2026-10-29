# Email authentication

Implemented with the official Supabase skill (supabase/agent-skills, skill v0.1.2).
The app interface is Vietnamese. Team documentation can remain English.

## User flow

Sign up with full name, email, password (8–128 characters), confirmation.
Passenger details belong to later checkout work. The account profile stores a
contact phone number for booking communication.
Supabase receives the password over HTTPS; our code does not persist passwords.
The name is display metadata, never authorization or an admin role.

If signup returns no session, enter the emailed numeric code in Verify email.
Verification uses `auth.verifyOtp({ email, token, type: 'email' })`. Return to
Verify email from login to resume after closing the app. Resend has a 60-second
UI cooldown; actual limits and code expiry are enforced by Supabase.
Account enumeration protections mean a signup/resend success does not prove
that the email address represents a new/unconfirmed account.

On launch, restore the SDK session before showing account/login. Listen to auth
events and avoid applying a stale startup response after sign-out. The SDK
handles refresh and native foreground/background refresh lifecycle.
Native persistence uses AsyncStorage as in Supabase's React Native quickstart;
this is app-local storage, not encrypted credential storage. Web uses the SDK's
browser storage. Server rendering does not persist a browser session.
Sign out uses scope `local` to affect this device, not all user devices.
UI session state is not server authorization: future tables still require RLS.

Forgot password sends a recovery email without disclosing whether the address has
an account. Enter the emailed numeric code in the app. Verification uses
`verifyOtp({ email, token, type: 'recovery' })`; after it creates a session,
the user sets a new password through `updateUser`. A 60-second resend cooldown
applies in the UI. Signed-in users can change their password by providing the
current password and a new one. The app never stores either password itself.

The account screen lets the user update their full name and contact phone. Both
are stored in Auth user metadata for this MVP. `contact_phone` is a booking
contact field, not an Auth phone login identifier. It must never authorize admin
actions. TV3 can move these fields to `profiles` when that table and RLS are ready.

## Required Dashboard setup (owner action)

The publishable key cannot manage Auth configuration. No cloud template change
has been made by this code.

1. In Supabase Authentication, keep email sign-in and Confirm email enabled.
2. Open email templates, select **Confirm signup**.
3. Set a subject such as `Your Flight verification code`.
4. Paste `supabase/templates/confirmation.html` into the email body and save.
   The `{{ .Token }}` expression must remain intact.
5. Use an email address allowed by your project's mail setup. Supabase's default
   mail service may restrict recipients and rate-limit sending; configure custom
   SMTP for a demo involving additional recipients or production usage.
6. In email templates, select **Reset password** and paste
   `supabase/templates/recovery.html` into the email body. Keep `{{ .Token }}`.

This flow does not require configuring a deep-link redirect to Expo Go.
The default email template sends a link instead of the code our screen expects;
update both templates before testing registration and recovery.

## Device acceptance checklist

- Create an account with an inbox you own; wrong/repeated passwords show errors.
- Read email, enter a wrong/expired code: stay signed out and see an error.
- Enter the correct code: account screen shows the email and name.
- Close/reopen the app: restore session without a login flash.
- Sign out, close/reopen: remain signed out.
- Try a wrong password, an unconfirmed account and a network interruption.
- Check form scroll/keyboard and password visibility on Android.
- Request a reset for a real and an unknown email; both show the same next step.
- Enter an invalid reset code, then a valid one; set a new password and sign in again.
- Edit full name and contact phone; close/reopen to confirm they persist.
- Change password with a wrong and then correct current password.

Automated tests cover validation, API boundary payloads and session startup races.
They do not send real email, create real users, or prove on-device delivery.

## References

- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/reference/javascript/auth-verifyotp
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-updateuser
