# Flight environment setup

Goal: Initialize the empty Flight repository as an Expo TypeScript application.

Agreed architecture: Expo Router mobile app, Supabase/PostgreSQL backend,
TanStack Query server state, Zustand checkout state, React Hook Form and Zod.
Vietnamese interface, Android first, sample flight data and simulated payments.
Full booking functionality and admin tools belong to later milestones.

## Setup tasks
- [x] Generate the official Expo default TypeScript/Router template.
- [x] Install the agreed libraries and Expo-compatible native dependencies.
- [x] Add environment examples, Supabase setup instructions and EAS build profiles.
- [x] Add typecheck/lint/export checks and continuous integration.
- [x] Document local startup, cloud setup and Android device requirements.
- [x] Verify package compatibility, TypeScript, lint and bundles.

Verification: typecheck + lint passed; Expo Doctor 20/20; Expo dependency check
passed; web and Android/Hermes export passed outside the Windows sandbox.
No device/emulator runtime test or APK build was performed. Audit has 8 upstream
issues documented in docs/SETUP.md. Installed libraries are not yet wired to app
features. Supabase cloud still needs user account/project configuration.

Keep cloud secrets out of Git. Cloud projects, live payments and app-store
publication are not created in this setup. No Android SDK was found at the
standard per-user path; use a physical device with Expo Go initially.
