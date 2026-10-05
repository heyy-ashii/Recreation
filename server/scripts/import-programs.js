// Copies programs from the old API into the database in MONGODB_URI (skips ones that already exist by _id).
// Usage: MONGODB_URI=... [SOURCE_API=https://ogea-sms-api.vercel.app] npm run import:programs
import { connectDB, disconnectDB } from '../db.js';
import { Program } from '../models/Program.js';

const source = process.env.SOURCE_API || 'https://ogea-sms-api.vercel.app';
const res = await fetch(`${source}/api/v1/programs`);
if (!res.ok) throw new Error(`Source API responded ${res.status}`);
const { data } = await res.json();

await connectDB();
let inserted = 0;
for (const p of data.programs) {
  const exists = await Program.exists({ _id: p._id });
  if (exists) continue;
  await Program.create({ ...p, type: p.type?.trim(), venue: p.venue?.trim() });
  inserted += 1;
}
console.info(`Imported ${inserted} of ${data.programs.length} programs from ${source}.`);
await disconnectDB();
