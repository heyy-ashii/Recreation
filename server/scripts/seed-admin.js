// Usage: MONGODB_URI=... ADMIN_USERNAME=... ADMIN_PASSWORD=... [ADMIN_EMAIL=...] [ADMIN_NAME=...] npm run seed:admin
// In Sheets mode set SHEETS_API_URL and SHEETS_API_TOKEN instead, and in Supabase
// mode set SUPABASE_URL plus SUPABASE_DB_URL (or the secret key); MongoDB is untouched.
import { datastore } from '../config.js';
import { connectDB, disconnectDB } from '../db.js';
import { User } from '../models/User.js';

const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL, ADMIN_NAME = 'DHGRAM Admin' } = process.env;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD (min 8 chars).');
  process.exit(1);
}

const usingMongo = datastore() === 'mongo';
if (usingMongo) await connectDB();
const username = ADMIN_USERNAME.toLowerCase();
let user = await User.findOne({ username }).select('+password');
if (user) {
  user.role = 'admin';
  user.status = 'active';
  user.password = ADMIN_PASSWORD;
  if (ADMIN_EMAIL) user.email = ADMIN_EMAIL.toLowerCase();
  await user.save();
  console.info(`Updated existing user "${username}" to admin and reset password.`);
} else {
  user = await User.create({ name: ADMIN_NAME, username, email: ADMIN_EMAIL?.toLowerCase(), password: ADMIN_PASSWORD, role: 'admin', emailVerified: Boolean(ADMIN_EMAIL) });
  console.info(`Created admin "${username}".`);
}
if (usingMongo) await disconnectDB();
