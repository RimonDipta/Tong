import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

export interface MessageAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
  publicId?: string;
  resourceType?: string;
}

/*
 * Attachments arrive from the client after an
 * upload, so only keep known fields and only
 * accept https URLs.
 */
function sanitizeAttachment(attachment: MessageAttachment): MessageAttachment {
  if (
    !attachment ||
    typeof attachment.url !== "string" ||
    !attachment.url.startsWith("https://") ||
    typeof attachment.name !== "string" ||
    typeof attachment.type !== "string"
  ) {
    throw new Error("Invalid attachment");
  }

  return {
    url: attachment.url,
    name: attachment.name.slice(0, 255),
    type: attachment.type.slice(0, 120),
    size: Number(attachment.size) || 0,
    publicId:
      typeof attachment.publicId === "string" ? attachment.publicId : undefined,
    resourceType:
      typeof attachment.resourceType === "string"
        ? attachment.resourceType
        : undefined,
  };
}

interface CreateMessageInput {
  conversationId: string;
  userId: string;
  content: string;
  replyTo?: string;
  attachments?: MessageAttachment[];
}

export async function createMessage({
  conversationId,
  userId,
  content,
  replyTo,
  attachments = [],
}: CreateMessageInput) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  const cleanContent = content.trim();

  if (!cleanContent && attachments.length === 0) {
    throw new Error("Message cannot be empty");
  }

  if (cleanContent.length > 5000) {
    throw new Error("Message cannot exceed 5000 characters");
  }

  if (attachments.length > 5) {
    throw new Error("You can attach a maximum of 5 files");
  }

  const cleanAttachments = attachments.map(sanitizeAttachment);

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  let replyToId: mongoose.Types.ObjectId | undefined;

  if (replyTo) {
    if (!mongoose.Types.ObjectId.isValid(replyTo)) {
      throw new Error("Invalid reply message ID");
    }

    const replyMessage = await Message.findOne({
      _id: replyTo,
      conversation: conversationId,
    });

    if (!replyMessage) {
      throw new Error("Reply message not found");
    }

    replyToId = replyMessage._id;
  }

  const message = await Message.create({
    conversation: conversationId,

    sender: userId,

    content: cleanContent,

    attachments: cleanAttachments,

    replyTo: replyToId,

    reactions: [],

    readBy: [userId],

    edited: false,

    deleted: false,
  });

  conversation.lastMessage = message._id;

  await conversation.save();

  await message.populate([
    {
      path: "sender",

      select: "name username email avatar bio isVerified isOnline lastSeen",
    },

    {
      path: "replyTo",

      populate: {
        path: "sender",

        select: "name username email avatar bio isVerified isOnline lastSeen",
      },
    },
  ]);

  return message;
}

interface EditMessageInput {
  messageId: string;
  userId: string;
  content: string;
}

export async function editMessage({
  messageId,
  userId,
  content,
}: EditMessageInput) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }

  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new Error("Message cannot be empty");
  }

  if (cleanContent.length > 5000) {
    throw new Error("Message cannot exceed 5000 characters");
  }

  const message = await Message.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.sender.toString() !== userId) {
    throw new Error("You can only edit your own messages");
  }

  if (message.deleted) {
    throw new Error("Deleted messages cannot be edited");
  }

  const conversation = await Conversation.findOne({
    _id: message.conversation,
    participants: userId,
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  message.content = cleanContent;

  message.edited = true;

  await message.save();

  await message.populate([
    {
      path: "sender",

      select: "name username email avatar bio isVerified isOnline lastSeen",
    },

    {
      path: "replyTo",

      populate: {
        path: "sender",

        select: "name username email avatar bio isVerified isOnline lastSeen",
      },
    },
  ]);

  return message;
}

interface DeleteMessageInput {
  messageId: string;
  userId: string;
}

export async function deleteMessage({ messageId, userId }: DeleteMessageInput) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }

  const message = await Message.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.sender.toString() !== userId) {
    throw new Error("You can only delete your own messages");
  }

  const conversation = await Conversation.findOne({
    _id: message.conversation,
    participants: userId,
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  message.content = "";

  message.attachments = [];

  message.replyTo = undefined;

  message.reactions = [];

  message.deleted = true;

  message.edited = false;

  await message.save();

  await message.populate({
    path: "sender",

    select: "name username email avatar bio isVerified isOnline lastSeen",
  });

  return message;
}
