import { createCollection } from './odm.js';

// Column maps translate the camelCase fields the routes use into the snake_case
// columns created by supabase/migrations/0001_init.sql.

const dateFields = (extra = []) => ['createdAt', 'updatedAt', ...extra];

const userSpec = {
  name: 'Users',
  table: 'app_users',
  columns: {
    name: 'name',
    username: 'username',
    email: 'email',
    password: 'password',
    role: 'role',
    status: 'status',
    emailVerified: 'email_verified',
    passwordChangedAt: 'password_changed_at',
    lastLoginAt: 'last_login_at',
    failedLoginAttempts: 'failed_login_attempts',
    lockUntil: 'lock_until',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  dates: dateFields(['passwordChangedAt', 'lastLoginAt', 'lockUntil']),
  numbers: ['failedLoginAttempts'],
  booleans: ['emailVerified'],
  defaults: { role: 'user', status: 'active', failedLoginAttempts: 0, emailVerified: false },
  hashesPassword: true,
  publicJSON: (u) => ({
    _id: u._id,
    name: u.name,
    username: u.username,
    email: u.email ?? null,
    role: u.role,
    status: u.status,
    emailVerified: Boolean(u.emailVerified),
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
  }),
};

const otpSpec = {
  name: 'Otps',
  table: 'app_otps',
  columns: {
    email: 'email',
    purpose: 'purpose',
    codeHash: 'code_hash',
    attempts: 'attempts',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  dates: dateFields(['expiresAt']),
  numbers: ['attempts'],
  defaults: { attempts: 0 },
  upsertOn: ['email', 'purpose'],
  publicJSON: (o) => ({ _id: o._id, email: o.email, purpose: o.purpose, attempts: o.attempts, expiresAt: o.expiresAt }),
};

const conversationSpec = {
  name: 'Conversations',
  table: 'app_conversations',
  columns: {
    user: 'user_id',
    status: 'status',
    lastMessage: 'last_message',
    lastMessageAt: 'last_message_at',
    unreadForAdmin: 'unread_for_admin',
    unreadForUser: 'unread_for_user',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  dates: dateFields(['lastMessageAt']),
  numbers: ['unreadForAdmin', 'unreadForUser'],
  defaults: { status: 'open', lastMessage: '', unreadForAdmin: 0, unreadForUser: 0, lastMessageAt: () => new Date() },
  publicJSON: (c) => ({ ...c }),
};

const messageSpec = {
  name: 'Messages',
  table: 'app_messages',
  columns: {
    conversation: 'conversation_id',
    sender: 'sender_id',
    senderRole: 'sender_role',
    body: 'body',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  dates: dateFields(),
  publicJSON: (m) => ({ _id: m._id, body: m.body, senderRole: m.senderRole, sender: m.sender, createdAt: m.createdAt }),
};

export const SupabaseUser = createCollection(userSpec);
export const SupabaseOtp = createCollection(otpSpec);
export const SupabaseConversation = createCollection(conversationSpec);
export const SupabaseMessage = createCollection(messageSpec);

conversationSpec.populates = { user: SupabaseUser };

export const publicUser = userSpec.publicJSON;
