import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && !env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 4000,
  mongoUri: env.MONGODB_URI || '',
  jwtSecret: env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  cookieName: 'ogea_token',
  corsOrigins: (env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  appUrl: env.APP_URL || 'http://localhost:5173',
  contactEmail: env.CONTACT_EMAIL || 'ogea.sms@gmail.com',
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 465,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || env.SMTP_USER || 'OGEA <ogea.sms@gmail.com>',
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: env.CLOUDINARY_API_KEY || '',
    apiSecret: env.CLOUDINARY_API_SECRET || '',
    folder: env.CLOUDINARY_FOLDER || 'ogea-api',
  },
  sheets: {
    apiUrl: env.SHEETS_API_URL || '',
    apiToken: env.SHEETS_API_TOKEN || '',
    timeoutMs: Number(env.SHEETS_TIMEOUT_MS) || 8000,
  },
  supabase: {
    url: env.SUPABASE_URL || '',
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY || '',
    // Bypasses RLS. Server-side only; never ship this to the browser.
    secretKey: env.SUPABASE_SECRET_KEY || '',
    jwksUrl: env.SUPABASE_JWKS_URL || '',
    // Optional direct Postgres connection string. When set, the Supabase
    // driver talks SQL over pg instead of HTTP through PostgREST.
    dbUrl: env.SUPABASE_DB_URL || '',
    timeoutMs: Number(env.SUPABASE_TIMEOUT_MS) || 10000,
  },
  otp: {
    ttlMinutes: 10,
    maxAttempts: 5,
    resendCooldownSeconds: 60,
  },
  login: {
    maxFailedAttempts: 5,
    lockMinutes: 15,
  },
};

export const emailConfigured = () => Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
export const cloudinaryConfigured = () =>
  Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
export const sheetsConfigured = () => Boolean(config.sheets.apiUrl && config.sheets.apiToken);

// The Supabase driver talks to Postgres, so SUPABASE_DB_URL is what enables it.
// SUPABASE_SECRET_KEY alone is not enough: PostgREST cannot run DDL, and the
// secret key is only needed later if we add the REST transport or Supabase Auth.
export const supabaseConfigured = () => Boolean(config.supabase.url && config.supabase.dbUrl);

// The datastore the models use. Supabase wins when configured, then Sheets,
// then MongoDB. Set SUPABASE_DB_URL to switch over; remove it to fall back.
export const datastore = () =>
  supabaseConfigured() ? 'supabase' : sheetsConfigured() ? 'sheets' : 'mongo';
