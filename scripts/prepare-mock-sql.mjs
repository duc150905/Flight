import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const args=process.argv.slice(2);const deployed=Number(args.find(s=>s.startsWith('--deployed='))?.split('=')[1]??0);
const suites=args.filter(s=>!s.startsWith('--deployed='));
if(!suites.length || suites.some(s=>!/^[a-z-]+$/.test(s))) throw Error('Pass mock suite names');
const migrations=readdirSync('supabase/migrations').filter(p=>p.startsWith('202611031436')&&p.endsWith('.sql')).sort();
const ddl=migrations.slice(deployed).map(p=>{
 const source=readFileSync(`supabase/migrations/${p}`,'utf8').trim();if(!source)return '';
 if(!/^begin;/i.test(source)||!source.endsWith('commit;'))throw Error(`Unwrapped migration ${p}`);
 const body=source.replace(/^begin;\s*/i,'').replace(/\bcommit;\s*$/i,'');
 if(/\b(commit|rollback)\s*;/i.test(body))throw Error(`Unexpected transaction boundary ${p}`);
 return body;
}).join('\n');
const tests=suites.map((s,i)=>`savepoint suite${i};\n${readFileSync('supabase/tests/mock-fixture.sql','utf8')}\n${readFileSync(`supabase/tests/mock-${s}.sql`,'utf8')}\nrollback to savepoint suite${i};`).join('\n');
writeFileSync('supabase/.temp/checkout-options/mock-candidate.sql',`begin;\n${ddl}\n${tests}\nrollback;`);
console.log('Prepared rollback SQL:',suites.join(', '));
