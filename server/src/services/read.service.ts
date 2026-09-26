import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

interface MarkConversationAsReadInput {
  conversationId: string;
  userId: string;
}

export async function markConversationAsRead({
  conversationId,
  userId,
}: MarkConversationAsReadInput) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const messages = await Message.find({
    conversation: conversationId,
    sender: { $ne: userId },
    readBy: { $ne: userId },
  }).select("_id");

  if (messages.length === 0) {
    return [];
  }

  const messageIds = messages.map((message) => message._id);

  await Message.updateMany(
    {
      _id: { $in: messageIds },
      readBy: { $ne: userId },
    },
    {
      $addToSet: {
        readBy: userId,
      },
    },
  );

  return messageIds.map((id) => id.toString());
}
