import mongoose from 'mongoose';
import { datastore } from '../config.js';
import { SheetsPost } from '../sheets/models.js';
import { SupabasePost } from '../supabase/models.js';

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    likes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

const MongoPost = mongoose.models.Post || mongoose.model('Post', postSchema);

const active = datastore();
export const Post = active === 'supabase' ? SupabasePost : active === 'sheets' ? SheetsPost : MongoPost;
