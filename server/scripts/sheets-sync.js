/**
 * One-time copy of programs from MongoDB into the Google Sheet.
 *
 *   SHEETS_API_URL=... SHEETS_API_TOKEN=... node server/scripts/sheets-sync.js
 *
 * Safe to re-run: programs already present in the sheet (matched by id) are skipped.
 */
import { config, sheetsConfigured } from '../config.js';
import { connectDB, disconnectDB } from '../db.js';
import { Program } from '../models/Program.js';
import { sheetsClient } from '../sheets/client.js';

async function run() {
  if (!sheetsConfigured()) {
    throw new Error('Set SHEETS_API_URL and SHEETS_API_TOKEN before syncing.');
  }
  await connectDB(config.mongoUri);

  const programs = await Program.find().sort({ createdAt: 1 }).lean();
  const existing = await sheetsClient.list({ limit: 100, view: 'full' });
  const known = new Set((existing.programs || []).map((p) => p._id || p.id));

  let copied = 0;
  let skipped = 0;
  for (const program of programs) {
    if (known.has(String(program._id))) {
      skipped += 1;
      continue;
    }
    await sheetsClient.create({
      id: String(program._id),
      title: program.title,
      organizer: program.organizer,
      type: program.type,
      category: program.category,
      venue: program.venue,
      about: program.about,
      registrationLink: program.registrationLink,
      contact: program.contact,
      imageurls: program.imageurls,
      tags: program.tags,
      status: program.status,
      deadline: program.deadline ? new Date(program.deadline).toISOString() : '',
      eventDate: program.eventDate ? new Date(program.eventDate).toISOString() : '',
    });
    copied += 1;
  }

  console.info(`[sheets-sync] copied ${copied}, skipped ${skipped} (already present)`);
}

run()
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('[sheets-sync] failed:', err.message);
    await disconnectDB().catch(() => {});
    process.exit(1);
  });
