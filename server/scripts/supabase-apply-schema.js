// Applies every SQL file in supabase/migrations, in name order, to whatever
// SUPABASE_DB_URL points at. Handy for CI or a fresh project; the Supabase
// dashboard SQL editor works too.
//
//   SUPABASE_DB_URL=postgresql://... npm run supabase:apply
//
import { readdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, query } from '../supabase/db.js';

const dir = dirname(fileURLToPath(new URL('../../supabase/migrations/0001_init.sql', import.meta.url)));
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

if (!files.length) {
  console.error(`No .sql files found in ${dir}`);
  process.exit(1);
}

for (const file of files) {
  const sql = await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
  await query(sql);
  console.info(`Applied supabase/migrations/${file}`);
}

await closePool();
