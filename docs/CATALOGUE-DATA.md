# Flyora catalogue data

`catalogue-data.json` supplies additional airport/airline/destination/product records and 36 route pairs. The generator creates both directions for 30 future days (2,160 flights), starting tomorrow in Vietnam time. It uses dedicated aircraft for each pair, an outbound/return rotation with 90 minutes turnaround, compatible cabin layouts and corresponding fare/service inventories. Existing identities are skipped, so reruns usually insert fewer rows than this maximum.

Airport names and IATA codes were checked against [ACV](https://acv.vn/vi), [Vietnam Airlines airport maps](https://airportmap.vietnamairlines.com/) and [IATA Hong Kong airport information](https://www.iata.org/globalassets/cnsc/cns-focus-magazine/2025/cns-fall-winter-2024-2025-small_v2.pdf). IANA timezone names are validated against PostgreSQL. Timetables, aircraft identifiers, cabin configurations and VND prices are synthetic learning data, not live airline availability or published carrier policies.

Fleet model references include [Singapore Airlines 737-8](https://www.singaporeair.com/en_UK/us/flying-withus/our-story/our-fleet/boeing-737-8/), [Malaysia Airlines 737-8](https://www.malaysiaairlines.com/my/en/experience/our-fleet-new/b737-8.html), [Korean Air A350](https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet/a350?hl=en), and [Airbus on THAI's A320 fleet](https://www.aircraft.airbus.com/en/newsroom/press-releases/2024-05-airbus-secures-thai-a320-cabin-retrofit-deal). Seat layouts deliberately use a simplified six-column renderer, rather than reproducing real aircraft seat maps.

Only ten catalogue tables may be written: airports, airlines, destinations, aircraft, seats, flight_instances, flight_fares, flight_seats, addon_products and flight_addon_offers. Existing inventory/prices are insert-only; legacy display names are normalized without changing their IDs or amounts. Booking/payment/refund/passenger/history tables and user roles are excluded. Within the repeatable-read seed transaction, fingerprints of every non-catalogue public table and private.user_roles are checked before and after; a difference aborts the transaction.

Do not run the old root seed against linked data to perform this expansion: it also contains unrelated admin-role provisioning and updates existing inventory. Use the dedicated generator, first with `--days 2 --rollback`, then apply 30 days after verification. It can run again without duplicating existing identities or reopening closed flights. It never resets the database, disables RLS, creates users, or configures payments. VNPAY Sandbox stays unchanged.

Generate a rollback probe (two executions in the same transaction), then generate the apply file:

```powershell
node scripts/generate-catalogue-seed.mjs --days 2 --rollback --repeat 2 --output supabase/.temp/catalogue-probe.sql
node scripts/generate-catalogue-seed.mjs --days 30 --output supabase/.temp/catalogue-apply.sql
```

Review the generated SQL, then execute the intended file using `supabase db query --linked --file ... --output json` with the installed CLI. The generator itself never connects to a database. Optional `--start YYYY-MM-DD` must be a future Vietnam date. Keep route pairs in their existing order (append new pairs) because flight numbers use the pair index; identities also include the pair and date. New flights alone receive fares, seats and offers; reruns never replenish or rewrite existing inventory. Newly inserted aircraft alone receive template seats.

Regenerate the English dictionary after editing the manifest:

```powershell
node scripts/generate-catalogue-seed.mjs --translations
```

New destinations are active but not featured, preserving the eight existing home cards and their bundled photos. The current generator only inserts baggage products/offers; reference meals and insurance are left untouched, respecting the current database capability triggers. Older flights may retain historical meal offers; new flights receive the two baggage offers only. Internal legacy enum/code values (`insurance_demo`, `DEMO_STANDARD`, etc.) remain for compatibility, while customer-facing names are normalized. The F0 carrier/24-seat regional aircraft are fictional Flyora fixtures; the other carrier names and airport geography are real. Tax/fee amounts are configured test data, not statutory tax rates or actual carrier pricing. No actual insurance coverage is issued by this application.

## Applied to flight-dev on 04 November 2026

Coverage: 05 November–04 December 2026 inclusive, 48 directional routes daily.

- Airports: 12 → 22; airlines: 6 → 10; destinations: 8 → 22.
- Aircraft: 10 → 34; template seats: 780 → 3,744.
- Flights: 394 → 1,834; fares: 1,957 → 6,577; flight seats: 32,916 → 210,756.
- Products: 10 → 15; flight offers: 3,126 → 10,326.
- Two-day repeated rollback probe passed. Protected non-catalogue fingerprints remained equal in the apply transaction. Read-only inventory checks passed (geometry, supported fare cabins, completed inventories, turnaround, no legacy display labels).

Try one adult, Economy Saver, on **06/11/2026**:

- DAD → PQC, VJ7002, 07:15 → 08:55 local; fare including configured tax/fees: 1,220,000 VND.
- DAD → ICN, KE7030, 08:45 Vietnam → 15:35 Korea; 3,650,000 VND.
- HAN → NRT, VN7034, 07:15 Vietnam → 14:45 Japan; 4,550,000 VND.
- SGN → DPS, VJ7046, 08:45 Vietnam → 13:35 Bali; 3,450,000 VND.

These totals exclude optional baggage/seat selection. International checkout needs nationality, passport number and expiry. Do not infer payment completion from catalogue validation; this task created no customer orders or payments.

## Added round-trip and multi-city coverage on 05 November 2026

Appended 12 pairs without reordering existing routes: PQC–CXR, CXR–DLI, DLI–HUI, HUI–DAD, HPH–HUI, SGN–DAD, HAN–DAD, SIN–BKK, BKK–KUL, KUL–SIN, HKG–TPE, ICN–NRT. Both directions run daily from **06 November to 05 December 2026**. Extended the original 24 pairs through 05 December as well.

Applied inserts: 12 aircraft, 1,392 template seats, **768 flights**, 2,314 fares, 89,448 flight seats and 1,536 baggage offers. Database totals after apply: 46 aircraft, 5,136 template seats, 2,602 flights, 8,891 fares, 300,204 flight seats and 11,862 offers. Non-catalogue fingerprints matched inside the transaction; no customer, booking, payment or refund data was changed.

The repeated two-day rollback probe passed. Read-only inventory checks passed after apply, including fare/cabin compatibility, baggage offers, seat geometry and aircraft turnaround. Public discovery checks (`SET LOCAL ROLE anon`, without changing grants) found all **23 legs across 7 sample itineraries** with correct chronological order. Seat inventory is verified separately with the existing privileged read-only inventory checks; discovery does not access the authenticated seat RPC tables directly.

See [Vietnamese test itineraries](CHECKOUT-ITINERARY-TESTS.md) and `supabase/tests/roundtrip-multicity-catalogue.sql`. All timetables and prices remain learning fixtures, not real airline availability. No APK build was performed.
