// Applies supabase/migrations/0001_init.sql to whatever SUPABASE_DB_URL points at.
// Handy for CI or a fresh project; the Supabase dashboard SQL editor works too.
//
//   SUPABASE_DB_URL=postgresql://... npm run supabase:apply
//
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { closePool, query } from '../supabase/db.js';

const sqlPath = fileURLToPath(new URL('../../supabase/migrations/0001_init.sql', import.meta.url));

const sql = await readFile(sqlPath, 'utf8');
await query(sql);
console.info('Applied supabase/migrations/0001_init.sql');
await closePool();
