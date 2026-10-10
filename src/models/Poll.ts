// ============================================
// Liberty City Bot - Poll Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IPollOption {
  text: string;
  votes: string[]; // userIds
}

export interface IPoll extends Document {
  guildId: string;
  channelId: string;
  messageId: string;
  ownerId: string;
  question: string;
  options: IPollOption[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PollOptionSchema = new Schema<IPollOption>(
  {
    text: { type: String, required: true },
    votes: [{ type: String }],
  },
  { _id: false }
);

const PollSchema = new Schema<IPoll>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    question: { type: String, required: true },
    options: [PollOptionSchema],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Poll = mongoose.model<IPoll>('Poll', PollSchema);
export default Poll;
