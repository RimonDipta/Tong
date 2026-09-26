import { Response } from "express";
import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

import { emitToUser } from "../services/socket.service.js";

const participantFields =
  "name username email avatar bio isVerified isOnline lastSeen";

export async function createDirectConversation(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = req.userId;

    const { userId: targetUserId } = req.body;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required",
      });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot start a conversation with yourself",
      });
    }

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let conversation = await Conversation.findOne({
      type: "direct",
      participants: {
        $all: [currentUserId, targetUserId],
        $size: 2,
      },
    }).populate("participants", participantFields);

    const conversationAlreadyExists = Boolean(conversation);

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [currentUserId, targetUserId],
        admins: [currentUserId],
      });

      await conversation.populate("participants", participantFields);
    }

    /*
     * Notify the other participant only
     * when this is a genuinely new
     * conversation.
     */
    if (!conversationAlreadyExists) {
      emitToUser(targetUserId, "conversation:new", conversation);
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Create direct conversation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create conversation",
    });
  }
}

export async function getConversations(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = req.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate("participants", participantFields)
      .populate("lastMessage")
      .sort({
        updatedAt: -1,
      });

    return res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get conversations",
    });
  }
}

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.userId;

    /*
     * Express 5 can type route params
     * as string | string[].
     *
     * This route only expects one
     * conversation ID, so normalize it
     * before giving it to Mongoose.
     */
    const conversationIdParam = req.params.conversationId;

    const conversationId = Array.isArray(conversationIdParam)
      ? conversationIdParam[0]
      : conversationIdParam;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const messages = await Message.find({
      conversation: conversationId,
    })
      .populate("sender", participantFields)
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: participantFields,
        },
      })
      .sort({
        createdAt: 1,
      });

    return res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get messages",
    });
  }
}

export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.userId;

    /*
     * Normalize Express 5's possible
     * string | string[] parameter type.
     */
    const conversationIdParam = req.params.conversationId;

    const conversationId = Array.isArray(conversationIdParam)
      ? conversationIdParam[0]
      : conversationIdParam;

    const { content } = req.body;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: currentUserId,
      content: content.trim(),
      attachments: [],
      reactions: [],
      readBy: [currentUserId],
      edited: false,
      deleted: false,
    });

    conversation.lastMessage = message._id;

    await conversation.save();

    await message.populate("sender", participantFields);

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Send message error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
}
