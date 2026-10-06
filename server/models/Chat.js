import mongoose from 'mongoose';
import { sheetsConfigured } from '../config.js';
import { SheetsConversation, SheetsMessage } from '../sheets/models.js';

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadForAdmin: { type: Number, default: 0 },
    unreadForUser: { type: Number, default: 0 },
  },
  { timestamps: true },
);
conversationSchema.index({ lastMessageAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['user', 'admin'], required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);
messageSchema.index({ conversation: 1, createdAt: 1 });

const MongoConversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
const MongoMessage = mongoose.models.Message || mongoose.model('Message', messageSchema);

const useSheets = sheetsConfigured();
export const Conversation = useSheets ? SheetsConversation : MongoConversation;
export const Message = useSheets ? SheetsMessage : MongoMessage;
