import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const catalogue = JSON.parse(readFileSync(new URL('../supabase/seeds/catalogue-data.json', import.meta.url), 'utf8'));

export function buildCatalogueTranslations() {
  const entries = {};
  for (const a of catalogue.airports) { entries[a[1]] = a[2]; entries[a[3]] = a[4]; }
  for (const d of catalogue.destinations) { entries[d[2]] = d[3]; entries[d[4]] = d[5]; }
  for (const p of catalogue.products) entries[p[1]] = p[2];
  return `// Generated from supabase/seeds/catalogue-data.json; edit the manifest, then regenerate.\nexport const expandedCatalogueEnglish = ${JSON.stringify(entries, null, 2)} as const;\n`;
}

export function buildCatalogueSql({ days = 30, startDate = null, rollback = false, repeat = 1 } = {}) {
  if (!Number.isInteger(days) || days < 1 || days > 60) throw new Error('days must be 1..60');
  if (![1, 2].includes(repeat)) throw new Error('repeat must be 1 or 2');
  if (repeat === 2 && !rollback) throw new Error('repeat is a rollback-only idempotence check');
  if (startDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0, 10) !== startDate)) {
    throw new Error('startDate must be a valid YYYY-MM-DD');
  }
  const template = readFileSync(new URL('../supabase/seeds/catalogue-expansion.sql', import.meta.url), 'utf8');
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  return template
    .replace('/* CATALOGUE_JSON */', literal(JSON.stringify(catalogue)))
    .replace('/* START_DATE */', startDate ? `${literal(startDate)}::date` : "(now() at time zone 'Asia/Ho_Chi_Minh')::date + 1")
    .replace('/* DAYS */', String(days))
    .replace('/* REPEAT */', String(repeat))
    .replace('/* FINISH */', rollback ? 'rollback;' : 'commit;');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const output = get('--output');
  if (args.includes('--translations')) {
    writeFileSync(new URL('../src/features/i18n/expanded-catalogue.ts', import.meta.url), buildCatalogueTranslations(), 'utf8');
    console.log('Generated catalogue translations.');
    process.exit(0);
  }
  if (!output) throw new Error('Use --output <file.sql>; this script generates SQL and never connects to a database.');
  writeFileSync(output, buildCatalogueSql({
    days: Number(get('--days') ?? 30), startDate: get('--start') ?? null,
    rollback: args.includes('--rollback'), repeat: Number(get('--repeat') ?? 1),
  }), 'utf8');
  console.log(`Generated catalogue SQL: ${output}`);
}
