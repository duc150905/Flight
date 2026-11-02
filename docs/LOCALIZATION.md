# Shared Vietnamese–English foundation

`src/features/i18n/provider.tsx` wraps the app once. Use `useLanguage()` for `language`, `t(key, params)` and `setLanguage('vi' | 'en')`; reuse `LanguagePicker` on another feature's screen.

Add English keys to `messages.ts` and matching Vietnamese entries (TypeScript checks completeness). Keep validation messages as stable keys and translate when rendering, so a visible error changes language without resetting form values. Use `formatDate`, `formatTime` and `formatMoney` from `translate.ts` rather than hardcoding a locale.

The first supported device language is used initially, with Vietnamese fallback. Manual choice is saved in AsyncStorage (`flight.language`), independent of authentication and checkout. Slow restoration cannot replace a newer manual choice. Writes are serialized; a storage failure leaves the current selection usable and displays a notice. The provider never keys/remounts the app by language.

Scope: shared infrastructure and checkout. TV1/TV3 can reuse these exports to translate their own screens without another language store.
