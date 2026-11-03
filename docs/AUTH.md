# Authentication

Implemented with the official Supabase skill (supabase/agent-skills, skill v0.1.2).
The app interface is Vietnamese. Team documentation can remain English.

## User flow

Sign up with full name, email, password (8–128 characters), confirmation.
Passenger details belong to later checkout work. The account profile stores a
contact phone number for booking communication.
Supabase receives the password over HTTPS; our code does not persist passwords.
The name is display metadata, never authorization or an admin role.

### Google sign-in

The login screen also offers **Tiếp tục với Google**. On web, Supabase redirects
the browser to Google and restores the returned session on `/account`. On native
Android/iOS, `expo-web-browser` opens Google's sign-in page; the app accepts the
`flight://account` callback and gives its access and refresh tokens to Supabase.
Closing the browser leaves the user signed out. This uses the same Supabase Auth
session and database permissions as email/password. It does not need SMTP or an
OTP email.

The Supabase project owner must configure Google once:

1. In Google Cloud's Google Auth Platform, configure the consent screen and
   create an **OAuth client ID** of type **Web application**. Add
   `http://localhost:8081` to Authorized JavaScript origins for web development.
   Add `https://qisvuxiuwsqtkcrfpiwu.supabase.co/auth/v1/callback` to Authorized
   redirect URIs (or copy the callback shown by the project's Google provider).
   If the consent screen is in Testing mode, add each tester's Google account.
2. In Supabase Dashboard > Authentication > Sign In / Providers > Google, enable
   Google and enter the Client ID and Client Secret. Keep the secret only in
   Supabase; do not put it in Git or an `EXPO_PUBLIC_*` variable.
3. In Supabase Dashboard > Authentication > URL Configuration > Redirect URLs,
   allow `http://localhost:8081/account` and `flight://account`. The exact web
   URL must match the address used to run the app. Expo Go opens the project at
   an `exp://` URL and cannot receive the app's `flight://account` callback.
   Test mobile OAuth in a Flyora APK or development build instead.
4. For an Android APK, use the `preview` profile in `eas.json`. The linked EAS
   project is `@deamoniis-team/Flight` and the Android package is
   `me.shopyora.flyora`. Configure `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the EAS **preview** environment
   before a cloud build; the local `.env.local` is gitignored. Never put the
   Supabase secret/service-role key in an `EXPO_PUBLIC_*` variable. Run
   `npx eas-cli@latest build --platform android --profile preview`.
5. Sign out, then test Google login on web and in the installed APK. Check
   account/profile and sign-out. A Google account using the same
   verified email as an existing user may be linked by Supabase; verify this
   against a disposable test account before using real accounts.

References: https://supabase.com/docs/guides/auth/social-sign-in/auth-google,
https://supabase.com/docs/guides/auth/native-mobile-deep-linking,
https://supabase.com/docs/guides/auth/redirect-urls, and
https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/.

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

The account screen reads and updates `public.profiles` for the signed-in user.
The database trigger creates a profile at signup using the Auth full-name
metadata; subsequent profile edits use only the profile table. RLS and column
grants allow a customer to read their own row and update only `full_name`,
`contact_phone`, and `avatar_path`. The app updates only the first two columns.
The phone is optional and stored as E.164 (`+84912345678`), or `null` when blank.
It is a booking contact field, not an Auth phone login identifier, and must
never authorize admin actions. A missing profile is shown as an error; the app
does not insert one from the client. Existing contact phones saved only in Auth
metadata before this change are not automatically copied into `profiles`; users
must re-enter them until a coordinated database backfill is performed.

## Required Dashboard setup (owner action)

The publishable key cannot manage Auth configuration. The client already calls
`signUp` and `verifyOtp({ email, token, type: 'email' })`, but the deployed
`flight-dev` project currently uses Supabase's default **link** email and has
custom SMTP disabled. On this Free project, the dashboard disables template
editing until custom SMTP is enabled (or the project is upgraded to Pro). Merely
committing the template file does not change the email sent by hosted Supabase.

1. Configure a transactional email provider under Authentication > Emails >
   SMTP Settings. Keep SMTP credentials in the Supabase dashboard only; do not
   put them in the Expo app, Git, or `EXPO_PUBLIC_*` variables. Alternatively,
   use a Send Email Auth Hook backed by an external email provider.
2. In Authentication > Sign In / Providers > Email, keep email sign-in and
   **Confirm email** enabled.
3. Open Authentication > Emails > Templates > **Confirm sign up**. Set the
   subject to `Mã xác nhận tài khoản Flyora`, paste
   `supabase/templates/confirmation.html` into the body, and save. Keep
   `{{ .Token }}` intact; the email must contain a numeric code instead of only
   `{{ .ConfirmationURL }}`.
4. For in-app password recovery, update **Reset password** with
   `supabase/templates/recovery.html`, also keeping `{{ .Token }}`.
5. Test with a **new** email address controlled by the tester. Re-registering a
   confirmed account can return an obfuscated success without sending another
   message. Check Auth Logs for delivery failures and email rate limits.

### Classroom SMTP option without a custom domain

A dedicated Gmail account can be used for a small classroom demo. Its address
will appear as the sender, so do not use a personal mailbox. The account owner
must enable Google 2-Step Verification and create a separate **App Password**
for Supabase. Enter that password directly in the Supabase dashboard, never in
the app or repository. If Google does not offer App Passwords for the account,
choose a transactional SMTP provider instead.

In Supabase **SMTP Settings**, use host `smtp.gmail.com`, port `465` (or `587`
with TLS), the dedicated Gmail address as both SMTP username and sender email,
the App Password as SMTP password, and `Flyora` as sender name. Save the SMTP
settings before editing **Confirm sign up**. The project owner may need to do
this if the SMTP switch is disabled for a team member's role.

References: https://support.google.com/accounts/answer/185833 and
https://supabase.com/kb/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y.

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
- Edit full name and contact phone; close/reopen to confirm they persist in
  `public.profiles`. Check a blank phone stores `null` and a formatted or local
  phone is rejected before reaching the database.
- Sign in as two different users and confirm neither can read or update the
  other's profile through the public API.
- Change password with a wrong and then correct current password.

Automated tests cover validation, API boundary payloads and session startup races.
Profile tests cover the filtered read/update request and missing-row handling;
live RLS behavior still requires two authenticated test users.
They do not send real email, create real users, or prove on-device delivery.

## References

- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/reference/javascript/auth-verifyotp
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-updateuser
