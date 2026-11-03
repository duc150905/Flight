# Customer copy and pricing display — 2026-11-03

- Vietnamese uses VND; English uses indicative USD. No currency selector.
- Language controls remain on home/auth entry screens, not inside checkout.
  Existing language persistence continues across all checkout steps.
- Known destination titles/cities/airport names and fixture fare/baggage names
  are translated at render time. Names, IDs and actual prices in the DB are not
  rewritten. Unknown catalogue values keep their original text.
- Bundled photos cover all eight seeded featured destinations; see asset credits.
- Age guidance describes under 2 / 2–11 / 12+ at each flight date, without a
  “demo rules” label. The existing validation policy is unchanged.
- Standard/Flex are fare bundles in the same Economy cabin, not different seat
  cabin classes. Labels alone never promise free changes/cancellations.
- Seed Standard adult: base 1,000,000 + tax 180,000 + fare fee 70,000 = 1,250,000 VND;
  7 kg cabin baggage, no included checked bag, cancellation not allowed.
- Seed Flex adult: base 1,400,000 + tax 180,000 + fare fee 70,000 = 1,650,000 VND;
  7 kg cabin + 20 kg checked baggage; configured cancellation fee 200,000 VND,
  subject to the fare's cutoff. Flight-change workflow is not implemented.
- Tax/fee amounts are configured per fare/passenger type. The adult tax in this
  fixture happens to equal 18% of the Standard base; it is not an implemented VAT
  rate or a legal statement about aviation taxes.
- Specific seat selection is optional and billed separately, not a second ticket.
  No automatic seat allocation/holding is implemented yet. Skipping paid seat
  choice gives a zero selection fee at quote time.
- Quote UI shows the inclusive fare subtotal, explains that the base/tax/fee
  detail is already included, then adds baggage and optional seat fees once.
  Example: 1,250,000 + 400,000 bag + 50,000 chosen seat = 1,700,000 VND.

This change does not write to Supabase or alter quote computation, inventory,
RLS, cancellation rules or booking/payment workflows.
