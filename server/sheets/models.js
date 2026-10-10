import { createCollection } from './odm.js';

const dateFields = (extra = []) => ['createdAt', 'updatedAt', ...extra];

const userSpec = {
  name: 'Users',
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
  dates: dateFields(['expiresAt']),
  numbers: ['attempts'],
  defaults: { attempts: 0 },
  publicJSON: (o) => ({ _id: o._id, email: o.email, purpose: o.purpose, attempts: o.attempts, expiresAt: o.expiresAt }),
};

const conversationSpec = {
  name: 'Conversations',
  dates: dateFields(['lastMessageAt']),
  numbers: ['unreadForAdmin', 'unreadForUser'],
  defaults: { status: 'open', lastMessage: '', unreadForAdmin: 0, unreadForUser: 0, lastMessageAt: () => new Date() },
  publicJSON: (c) => ({ ...c }),
};

const messageSpec = {
  name: 'Messages',
  dates: dateFields(),
  publicJSON: (m) => ({ _id: m._id, body: m.body, senderRole: m.senderRole, sender: m.sender, createdAt: m.createdAt }),
};

const postSpec = {
  name: 'Posts',
  dates: dateFields(),
  booleans: ['hidden'],
  defaults: { likes: [], hidden: false },
  publicJSON: (p) => ({ ...p }),
};

export const SheetsUser = createCollection(userSpec);
export const SheetsOtp = createCollection(otpSpec);
export const SheetsConversation = createCollection(conversationSpec);
export const SheetsMessage = createCollection(messageSpec);
export const SheetsPost = createCollection(postSpec);

conversationSpec.populates = { user: SheetsUser };
postSpec.populates = { author: SheetsUser };

// Shared shape for a user as returned to clients, used for .lean() results.
export const publicUser = userSpec.publicJSON;
