import mongoose, { Document, Schema, Types } from "mongoose";

export type ConversationType = "direct" | "group";

export interface IConversation extends Document {
  type: ConversationType;
  participants: Types.ObjectId[];
  admins: Types.ObjectId[];
  name?: string;
  avatar?: string;
  lastMessage?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      required: true,
    },

    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    avatar: {
      type: String,
      default: "",
    },

    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  {
    timestamps: true,
  },
);

const Conversation = mongoose.model<IConversation>(
  "Conversation",
  conversationSchema,
);

export default Conversation;
