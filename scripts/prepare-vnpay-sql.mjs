import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {migrationBody} from './sql-transaction.mjs';
const args=process.argv.slice(2),deployed=Number(args.find(a=>a.startsWith('--deployed='))?.split('=')[1]??0);
const suites=args.filter(a=>!a.startsWith('--deployed='));
if(!suites.length||suites.some(a=>!/^[a-z-]+$/.test(a)))throw Error('Suite names required');
const migrations=readdirSync('supabase/migrations').filter(a=>a.includes('_vnpay_')).sort().slice(deployed);
const ddl=migrations.map(a=>migrationBody(readFileSync(`supabase/migrations/${a}`,'utf8'),a)).join('\n');
const tests=suites.map((a,i)=>`savepoint test${i};\n${readFileSync('supabase/tests/mock-fixture.sql','utf8')}\n${readFileSync(`supabase/tests/vnpay-${a}.sql`,'utf8')}\nrollback to savepoint test${i};`).join('\n');
writeFileSync('supabase/.temp/checkout-options/vnpay-candidate.sql',`begin;\n${ddl}\n${tests}\nrollback;`);
