import mongoose from 'mongoose';
import { datastore } from '../config.js';
import { SheetsPeerConversation, SheetsPeerMessage } from '../sheets/models.js';
import { SupabasePeerConversation, SupabasePeerMessage } from '../supabase/models.js';

// Student-to-student direct messages. A conversation is a single pair of users
// stored in a fixed order (userA < userB) so one equality lookup finds it and a
// unique index prevents a second thread for the same two people. `unreadForA`
// and `unreadForB` are relative to the participant, not to a role.

const peerConversationSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadForA: { type: Number, default: 0 },
    unreadForB: { type: Number, default: 0 },
  },
  { timestamps: true },
);
peerConversationSchema.index({ userA: 1, userB: 1 }, { unique: true });
peerConversationSchema.index({ lastMessageAt: -1 });

const peerMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'PeerConversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);
peerMessageSchema.index({ conversation: 1, createdAt: 1 });

const MongoPeerConversation =
  mongoose.models.PeerConversation || mongoose.model('PeerConversation', peerConversationSchema);
const MongoPeerMessage = mongoose.models.PeerMessage || mongoose.model('PeerMessage', peerMessageSchema);

const active = datastore();
export const PeerConversation =
  active === 'supabase' ? SupabasePeerConversation : active === 'sheets' ? SheetsPeerConversation : MongoPeerConversation;
export const PeerMessage = active === 'supabase' ? SupabasePeerMessage : active === 'sheets' ? SheetsPeerMessage : MongoPeerMessage;

// Deterministic participant order, and the unread column that belongs to each.
// Shared by the routes so the "which side am I on" logic lives in one place.
export function pairFor(a, b) {
  const [userA, userB] = [String(a), String(b)].sort();
  return { userA, userB };
}

// Participants arrive either as raw ids or as populated documents, so compare
// on `_id` when the value is an object.
const idOf = (value) => (value && typeof value === 'object' ? value._id : value);

export function sideFor(conversation, userId) {
  const me = String(userId);
  if (String(idOf(conversation.userA)) === me) return { key: 'a', peerId: conversation.userB };
  if (String(idOf(conversation.userB)) === me) return { key: 'b', peerId: conversation.userA };
  return null;
}

export function isParticipant(conversation, userId) {
  return sideFor(conversation, userId) !== null;
}

export function unreadFor(conversation, userId) {
  const side = sideFor(conversation, userId);
  if (!side) return 0;
  return (side.key === 'a' ? conversation.unreadForA : conversation.unreadForB) ?? 0;
}
