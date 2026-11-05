# Meal catalogue and checkout

The meal capability migration must be deployed before applying this seed. The menu is reproducible application data, with configured VND prices and ingredient/allergen descriptions rather than live airline catering inventory. Each passenger can choose one meal for each flight leg, independently of checked baggage. Infant eligibility follows the server checkout policy.

`supabase/seeds/meal-catalogue.json` is the source of bilingual names/descriptions. Initial prices per passenger per leg:

- Cơm gà sốt gừng / Ginger chicken rice: **110,000 VND** (`MEAL_CHICKEN_RICE`).
- Cơm bò sốt tiêu / Pepper beef rice: **130,000 VND** (`MEAL_BEEF_RICE`).
- Cơm đậu hũ rau củ / Tofu and vegetable rice: **95,000 VND** (`MEAL_TOFU_RICE`).
- Bánh mì kẹp gà / Chicken sandwich: **85,000 VND** (`MEAL_CHICKEN_SANDWICH`).
- Mì Ý sốt cà chua rau củ / Vegetable tomato pasta: **105,000 VND** (`MEAL_VEGETABLE_PASTA`).
- Trái cây và sữa chua / Fruit and yogurt: **75,000 VND** (`MEAL_FRUIT_YOGURT`).

Descriptions list ingredients, allergens and possible cross-contact. The vegetarian meals are not labelled allergen-free or vegan. The UI should show the full description before purchase and translate both the name and description using the manifest's English text.

## Generate, probe, apply

The generator writes SQL files only; it never connects to a database. Use PowerShell in the project root:

```powershell
node scripts/generate-meal-seed.mjs --output supabase/seeds/meal-catalogue.sql
node scripts/generate-meal-seed.mjs --rollback --repeat 2 --output supabase/.temp/meal-catalogue-probe.sql
```

Review the generated files. After deploying the meal capability migration, execute the probe against the intended database with the installed Supabase CLI/SQL runner. Check the current CLI version and `supabase db query --help` to select the target explicitly; CLI v3 defaults to local, whereas this repository's earlier instructions used v2 `--linked`. The probe finishes with `ROLLBACK`; its second run must report zero inserted products and zero inserted offers. Then execute `supabase/seeds/meal-catalogue.sql` to commit, and run the read-only `supabase/tests/meal-catalogue.sql` verification.

For a fresh menu with no existing identities, the result reports six inserted products and `eligible_flights × 6` inserted offers. Rerunning immediately inserts zero. Existing matching products/offers may reduce the initial insert count. Temporary tables disappear on transaction completion; helper functions live only in the connection's temporary schema and disappear when the connection ends. Repeated execution on the same connection replaces those helpers. No persistent application functions, grants, policies or schema changes are installed.

The seed targets published `scheduled`/`delayed` flights with departure and sales close in the future at transaction start. It inserts only missing rows in `addon_products` and `flight_addon_offers`, using stable UUIDs derived from `flyora-meal-catalogue-v1`. New offers are active, VND, quantity one. Existing descriptions, prices and active flags are preserved, including admin deactivation; conflicts in product identity/category abort the transaction. Legacy meal, insurance and baggage products/offers are untouched. The seed never changes fares, seats, passengers, bookings, payments or refunds, reopens flights, resets the database or provisions roles.

Before and after writes, the transaction checks hashes of every other public/private table, including inventory, customer state and role/payment records. It also compares every existing product/offer row and checks that all new rows belong to this menu and the eligible flights. A mismatch aborts all inserts. Hashes are checked without returning customer row content. The result reports run counts and coverage; the `protected_data_unchanged` flags are emitted only after all assertions succeed.

## Future flight generation

After each catalogue expansion batch (including four-cabin batches), rerun `supabase/seeds/meal-catalogue.sql`, then `supabase/tests/meal-catalogue.sql`. This attaches meals to newly created open flights and preserves every existing offer. The existing catalogue expansion generator remains responsible for flights, fares, seats and baggage; the standalone meal step is required for new flight coverage. Do not run the root `supabase/seed.sql` to add meals to an existing project.

## Mobile acceptance

1. Search a future open flight, select a fare, and continue with two adults and a child. Verify all six menu items, VND prices and ingredient/allergen descriptions. Switch Vietnamese/English; both name and description should change.
2. Add a meal and a checked bag for the same passenger. Verify both remain selected and both amounts appear in the total. Replace the meal: only the meal selection/price changes. Remove the meal: the bag remains.
3. Pick different meals for different passengers and different legs of a round trip or multi-city journey. Navigate back/forward and verify selections persist independently. Verify the implemented server policy for infants in the UI.
4. Continue to review and create a booking using the existing sandbox payment flow. Check that quoted totals and persisted meal snapshots match the selected per-person/per-leg offers. The seed itself creates no booking or payment.
5. In admin, deactivate one meal offer, then start a new checkout for that flight. Verify it cannot be newly purchased. Rerun the meal seed and verify the offer stays disabled. Change a price and verify a fresh quote uses the server's current amount; historical booking snapshots must stay unchanged.

Seed execution, protected-state comparison and device acceptance must be recorded separately from local typecheck/lint results. Generating the SQL alone does not establish that the migration is deployed or the menu is available on a phone.
