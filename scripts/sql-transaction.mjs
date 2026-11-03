/** Candidate tests must never commit DDL outside their enclosing rollback. */
export function migrationBody(source,name){
 source=source.trim();if(!source)return '';
 if(!/^begin;/i.test(source)||!source.endsWith('commit;'))throw Error(`Unwrapped migration ${name}`);
 const body=source.replace(/^begin;\s*/i,'').replace(/\bcommit;\s*$/i,'');
 if(/\b(commit|rollback)\s*;/i.test(body))throw Error(`Unexpected transaction boundary ${name}`);
 return body;
}
