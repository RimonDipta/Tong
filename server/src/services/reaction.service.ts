import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

interface ToggleReactionInput {
  messageId: string;
  userId: string;
  emoji: string;
}

const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const USER_FIELDS =
  "name username email avatar bio isVerified isOnline lastSeen";

export async function toggleReaction({
  messageId,
  userId,
  emoji,
}: ToggleReactionInput) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }

  if (!ALLOWED_REACTIONS.includes(emoji)) {
    throw new Error("Invalid reaction");
  }

  const message = await Message.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  /*
   * Make sure the user actually belongs
   * to the conversation containing the
   * message.
   */
  const conversation = await Conversation.findOne({
    _id: message.conversation,
    participants: userId,
  });

  if (!conversation) {
    throw new Error("You are not a member of this conversation");
  }

  /*
   * Each user can have only one reaction
   * on a message.
   *
   * Clicking the same reaction removes it.
   * Clicking another reaction replaces it.
   */
  const existingReaction = message.reactions.find(
    (reaction) => reaction.user.toString() === userId,
  );

  if (existingReaction) {
    if (existingReaction.emoji === emoji) {
      message.reactions = message.reactions.filter(
        (reaction) => reaction.user.toString() !== userId,
      );
    } else {
      existingReaction.emoji = emoji;
    }
  } else {
    message.reactions.push({
      user: new mongoose.Types.ObjectId(userId),
      emoji,
    });
  }

  await message.save();

  /*
   * Populate the sender exactly like
   * normal message responses.
   */
  await message.populate({
    path: "sender",
    select: USER_FIELDS,
  });

  /*
   * IMPORTANT:
   *
   * Also populate replyTo and the sender
   * inside replyTo.
   *
   * Without this, reacting to a message
   * that is itself a reply can cause the
   * frontend to receive an incomplete
   * message object.
   */
  await message.populate({
    path: "replyTo",
    populate: {
      path: "sender",
      select: USER_FIELDS,
    },
  });

  return message;
}
