import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const suites=process.argv.slice(2);
if(!suites.length || suites.some(s=>!/^[a-z-]+$/.test(s))) throw Error('Pass mock suite names');
const migrations=readdirSync('supabase/migrations').filter(p=>p.startsWith('202611031436')&&p.endsWith('.sql')).sort();
const ddl=migrations.map(p=>readFileSync(`supabase/migrations/${p}`,'utf8').replace(/^(begin;|commit;)\s*$/gm,'')).join('\n');
const tests=suites.map((s,i)=>`savepoint suite${i};\n${readFileSync('supabase/tests/mock-fixture.sql','utf8')}\n${readFileSync(`supabase/tests/mock-${s}.sql`,'utf8')}\nrollback to savepoint suite${i};`).join('\n');
writeFileSync('supabase/.temp/checkout-options/mock-candidate.sql',`begin;\n${ddl}\n${tests}\nrollback;`);
console.log('Prepared rollback SQL:',suites.join(', '));
