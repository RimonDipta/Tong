import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  conversation: Types.ObjectId;

  sender: Types.ObjectId;

  content: string;

  attachments: {
    url: string;
    name: string;
    type: string;
    size: number;
    publicId?: string;
    resourceType?: string;
  }[];

  replyTo?: Types.ObjectId;

  reactions: {
    user: Types.ObjectId;
    emoji: string;
  }[];

  readBy: Types.ObjectId[];

  edited: boolean;

  deleted: boolean;

  createdAt: Date;

  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    attachments: [
      {
        url: {
          type: String,
          required: true,
        },

        name: {
          type: String,
          required: true,
        },

        type: {
          type: String,
          required: true,
        },

        size: {
          type: Number,
          required: true,
        },

        publicId: {
          type: String,
        },

        resourceType: {
          type: String,
        },
      },
    ],

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },

    reactions: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },

        emoji: {
          type: String,
          required: true,
        },
      },
    ],

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    edited: {
      type: Boolean,
      default: false,
    },

    deleted: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  },
);

const Message = mongoose.model<IMessage>("Message", messageSchema);

export default Message;
