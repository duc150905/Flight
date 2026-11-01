import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = process.cwd();
const seedPath = path.join(rootDir, 'supabase', 'seed.sql');
const configPath = path.join(rootDir, 'supabase', 'config.toml');

test('supabase/config.toml enables db.seed and points to ./seed.sql', () => {
  const configText = fs.readFileSync(configPath, 'utf8');
  assert.match(configText, /\[db\.seed\][\s\S]*?enabled\s*=\s*true/);
  assert.match(configText, /sql_paths\s*=\s*\[\s*"\.\/seed\.sql"\s*\]/);
});

test('supabase/seed.sql exists and seeds all required TV3 catalogue and flight tables idempotently', () => {
  assert.equal(fs.existsSync(seedPath), true, 'supabase/seed.sql must exist');
  const sql = fs.readFileSync(seedPath, 'utf8');

  const requiredTables = [
    'public.airports',
    'public.airlines',
    'public.destinations',
    'public.aircraft',
    'public.seats',
    'public.addon_products',
    'public.flight_instances',
    'public.flight_fares',
    'public.flight_seats',
    'public.flight_addon_offers',
    'private.user_roles',
  ];

  for (const table of requiredTables) {
    assert.ok(
      sql.includes(`insert into ${table}`),
      `seed.sql must insert into ${table}`,
    );
  }

  // Verify idempotency clauses
  assert.match(sql, /on conflict \(iata_code\) do update/i);
  assert.match(sql, /on conflict \(slug\) do update/i);
  assert.match(sql, /on conflict \(registration_code\) do update/i);
  assert.match(sql, /on conflict \(aircraft_id,\s*seat_code\) do update/i);
  assert.match(sql, /on conflict \(code\) do update/i);
  assert.match(sql, /on conflict \(airline_id,\s*flight_number,\s*departure_at\) do update/i);
  assert.match(sql, /on conflict \(flight_id,\s*fare_code\) do update/i);
  assert.match(sql, /on conflict \(flight_id,\s*seat_id\) do update/i);
  assert.match(sql, /on conflict \(flight_id,\s*product_id\) do update/i);
  assert.match(sql, /on conflict \(user_id\) do nothing/i);
});

test('supabase/seed.sql includes both domestic and international airports and all 4 cabin classes', () => {
  const sql = fs.readFileSync(seedPath, 'utf8');

  // Domestic & international airports for TV1 search and TV2 passport policy
  for (const code of ['SGN', 'HAN', 'DAD', 'PQC', 'CXR', 'DLI', 'HUI', 'SIN', 'BKK']) {
    assert.match(sql, new RegExp(`'${code}'`), `Expected airport ${code} in seed.sql`);
  }

  // All 4 cabin classes
  for (const cabin of ['economy', 'premium_economy', 'business', 'first']) {
    assert.match(sql, new RegExp(`'${cabin}'::public\\.cabin_class`), `Expected cabin ${cabin} in seed.sql`);
  }

  // Add-on categories
  for (const category of ['baggage', 'meal', 'insurance_demo']) {
    assert.match(sql, new RegExp(`'${category}'`), `Expected addon category ${category} in seed.sql`);
  }
});

