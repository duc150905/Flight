// Build one rollback-only SQL check usable with Supabase CLI's Management API.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const seed = (await readFile(new URL('../supabase/seeds/checkout-demo.sql', import.meta.url), 'utf8'))
  .replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
const tests = (await readFile(new URL('../supabase/tests/checkout-demo.sql', import.meta.url), 'utf8'))
  .replace(/^begin;\s*$/m, '').replace(/^rollback;\s*$/m, '');
const tables = ['airports', 'airlines', 'aircraft', 'seats', 'flight_instances', 'flight_fares', 'flight_seats', 'addon_products', 'flight_addon_offers'];
const snapshots = tables.map(table => `select '${table}' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) as hash from public.${table} r`).join('\nunion all\n');
const sql = `begin;
create temporary table catalogue_before on commit drop as ${snapshots};
${seed}
create temporary table catalogue_after on commit drop as ${snapshots};
do $$ begin
  if exists(select * from catalogue_before except select * from catalogue_after)
    or exists(select * from catalogue_after except select * from catalogue_before) then
    raise exception 'Seed rerun changed existing catalogue rows';
  end if;
end $$;
${tests}
rollback;
`;
const directory = new URL('../supabase/.temp/checkout-next/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('demo-rerun.sql', directory), sql);
console.log('Generated supabase/.temp/checkout-next/demo-rerun.sql (rollback-only)');
