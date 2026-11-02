# Checkout: per-leg travellers, Vietnamese/English and reference UI

User approved six tasks on 2026-11-02, one commit each. Source UI is
`C:/Users/DUC/Documents/8_flight/flight.pdf`, page 12 (Traveller information),
with the four-stage traveller/baggage/seat/payment indicator and fixed footer.
Do not implement baggage/seat/payment operations in this scope.

1. Search counts describe travellers on the first departure. Stable draft IDs
   remain unchanged; actual type, seat requirement and companion are derived per
   leg. A birthday never requires a new booking. Each infant on each leg needs
   a distinct companion >=18 on that leg. Validate companion only on infant legs.
2. Global vi/en language provider, initial device language then Vietnamese
   fallback, manual persisted override. Hydration must not overwrite a user's
   newer choice; storage failure must not crash or prevent changing language.
   Provider remains outside checkout/auth so changing language never remounts
   the draft. Use Expo Localization with existing AsyncStorage and a typed local
   dictionary; no heavyweight translation dependency needed for two languages.
3. Translate all checkout labels, errors, loading/empty states, accessibility
   text and review. Domain errors use stable message keys and are translated at
   render time; existing field errors change language without resetting forms.
4. White/turquoise visual tokens, compact outlined inputs, four connected vector
   icons, back header, fixed total/Continue footer. Display prices only when
   backed by current data; estimates clearly labelled, no fake quote/order.
5. One Traveller information screen combining independent traveller cards and
   contact section, as PDF. Keep DOB, conditional passport and infant companion
   fields. Include gender from PDF as optional demo detail. Review remains an
   informational checkpoint until later baggage/booking work. Old contact URL
   redirects to the combined form. UI labels use selected language.
6. Deterministic, insert-only development fixtures for airports/airline/aircraft,
   seats, future domestic + international return flights, fares and add-ons.
   Never overwrite shared catalogue rows, create users, grant roles, create real
   bookings or reset the cloud database. Verify with rollback/query assertions.

User authorizes compatible DB changes if needed for UI. If gender needs a DB
field, add a nullable constrained column through a versioned migration, never
rewrite historical data. Document schema/seed deployment separately from code.

Verify real behavior using Node tests (age boundaries, per-leg companions,
locale persistence races, translation coverage, form preservation and fixture
queries), lint/typecheck per task, bundles at end and one independent review.
Preserve unrelated untracked team handoff/ZIP. No push/merge requested here.
