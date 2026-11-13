import { Response } from "express";
import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

import { emitToConversation, emitToUser } from "../services/socket.service.js";

const participantFields =
  "name username email avatar bio isVerified isOnline lastSeen";

function getConversationId(req: AuthenticatedRequest) {
  const conversationIdParam = req.params.conversationId;

  return Array.isArray(conversationIdParam)
    ? conversationIdParam[0]
    : conversationIdParam;
}

function isGroupAdmin(
  conversation: {
    admins: mongoose.Types.ObjectId[];
  },
  userId: string,
) {
  return conversation.admins.some((adminId) => adminId.toString() === userId);
}

/*
|--------------------------------------------------------------------------
| Direct conversation
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Group conversation
|--------------------------------------------------------------------------
*/

export async function createGroupConversation(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = req.userId;

    const { name, participantIds } = req.body;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    const cleanName = name.trim();

    if (cleanName.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Group name cannot be empty",
      });
    }

    if (cleanName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Group name cannot exceed 100 characters",
      });
    }

    if (!Array.isArray(participantIds)) {
      return res.status(400).json({
        success: false,
        message: "Participant IDs must be an array",
      });
    }

    /*
     * Creator + at least two other users.
     */
    if (participantIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "A group must contain at least 3 members",
      });
    }

    /*
     * Maximum 100 total members.
     */
    if (participantIds.length > 99) {
      return res.status(400).json({
        success: false,
        message: "A group cannot contain more than 100 members",
      });
    }

    const uniqueParticipantIds = [
      ...new Set(participantIds.map((id) => String(id))),
    ];

    if (uniqueParticipantIds.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate participant IDs are not allowed",
      });
    }

    for (const participantId of uniqueParticipantIds) {
      if (!mongoose.Types.ObjectId.isValid(participantId)) {
        return res.status(400).json({
          success: false,
          message: "One or more participant IDs are invalid",
        });
      }
    }

    if (uniqueParticipantIds.includes(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: "You do not need to add yourself as a participant",
      });
    }

    const participants = [
      new mongoose.Types.ObjectId(currentUserId),
      ...uniqueParticipantIds.map((id) => new mongoose.Types.ObjectId(id)),
    ];

    const users = await User.find({
      _id: {
        $in: participants,
      },
    }).select(
      "_id name username email avatar bio isVerified isOnline lastSeen",
    );

    if (users.length !== participants.length) {
      return res.status(404).json({
        success: false,
        message: "One or more participants were not found",
      });
    }

    const conversation = await Conversation.create({
      type: "group",
      participants,
      admins: [new mongoose.Types.ObjectId(currentUserId)],
      name: cleanName,
    });

    await conversation.populate("participants", participantFields);

    for (const participantId of uniqueParticipantIds) {
      emitToUser(participantId, "conversation:new", conversation);
    }

    return res.status(201).json({
      success: true,
      message: "Group conversation created successfully",
      conversation,
    });
  } catch (error) {
    console.error("Create group conversation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create group conversation",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Get conversations
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Get messages
|--------------------------------------------------------------------------
*/

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.userId;

    const conversationId = getConversationId(req);

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

/*
|--------------------------------------------------------------------------
| Send message
|--------------------------------------------------------------------------
*/

export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.userId;

    const conversationId = getConversationId(req);

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

/*
|--------------------------------------------------------------------------
| Get group members
|--------------------------------------------------------------------------
*/

export async function getGroupMembers(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = req.userId;
    const conversationId = getConversationId(req);

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
      type: "group",
      participants: currentUserId,
    }).populate("participants", participantFields);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Group conversation not found",
      });
    }

    return res.json({
      success: true,
      members: conversation.participants,
      admins: conversation.admins.map((id) => id.toString()),
    });
  } catch (error) {
    console.error("Get group members error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get group members",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Add group members
|--------------------------------------------------------------------------
*/

export async function addGroupMembers(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = req.userId;
    const conversationId = getConversationId(req);

    const { participantIds } = req.body;

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

    if (!Array.isArray(participantIds)) {
      return res.status(400).json({
        success: false,
        message: "Participant IDs must be an array",
      });
    }

    if (participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one participant is required",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Group conversation not found",
      });
    }

    if (!isGroupAdmin(conversation, currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Only group admins can add members",
      });
    }

    const uniqueParticipantIds = [
      ...new Set(participantIds.map((id) => String(id))),
    ];

    if (uniqueParticipantIds.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate participant IDs are not allowed",
      });
    }

    for (const participantId of uniqueParticipantIds) {
      if (!mongoose.Types.ObjectId.isValid(participantId)) {
        return res.status(400).json({
          success: false,
          message: "One or more participant IDs are invalid",
        });
      }
    }

    const existingIds = new Set(
      conversation.participants.map((id) => id.toString()),
    );

    const idsToAdd = uniqueParticipantIds.filter((id) => !existingIds.has(id));

    if (idsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All selected users are already members",
      });
    }

    if (conversation.participants.length + idsToAdd.length > 100) {
      return res.status(400).json({
        success: false,
        message: "A group cannot contain more than 100 members",
      });
    }

    const users = await User.find({
      _id: {
        $in: idsToAdd,
      },
    }).select(
      "_id name username email avatar bio isVerified isOnline lastSeen",
    );

    if (users.length !== idsToAdd.length) {
      return res.status(404).json({
        success: false,
        message: "One or more users were not found",
      });
    }

    const objectIds = idsToAdd.map((id) => new mongoose.Types.ObjectId(id));

    conversation.participants.push(...objectIds);

    await conversation.save();

    await conversation.populate("participants", participantFields);

    /*
     * Tell existing group members that the
     * conversation membership changed.
     */
    emitToConversation(conversationId, "conversation:members-updated", {
      conversation,
    });

    /*
     * Tell newly added users about the group.
     */
    for (const participantId of idsToAdd) {
      emitToUser(participantId, "conversation:new", conversation);
    }

    return res.status(200).json({
      success: true,
      message: "Members added successfully",
      conversation,
      addedMembers: users,
    });
  } catch (error) {
    console.error("Add group members error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add group members",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Remove group member
|--------------------------------------------------------------------------
*/

export async function removeGroupMember(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = req.userId;
    const conversationId = getConversationId(req);

    const userIdParam = req.params.userId;

    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;

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

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Use the leave group action to remove yourself",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Group conversation not found",
      });
    }

    if (!isGroupAdmin(conversation, currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Only group admins can remove members",
      });
    }

    const memberExists = conversation.participants.some(
      (id) => id.toString() === userId,
    );

    if (!memberExists) {
      return res.status(404).json({
        success: false,
        message: "User is not a group member",
      });
    }

    /*
     * Don't allow the last remaining admin
     * to be removed.
     */
    const removingAdmin = conversation.admins.some(
      (id) => id.toString() === userId,
    );

    if (removingAdmin) {
      const remainingAdmins = conversation.admins.filter(
        (id) => id.toString() !== userId,
      );

      if (remainingAdmins.length === 0) {
        return res.status(400).json({
          success: false,
          message: "The last admin cannot be removed",
        });
      }
    }

    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== userId,
    );

    conversation.admins = conversation.admins.filter(
      (id) => id.toString() !== userId,
    );

    await conversation.save();

    await conversation.populate("participants", participantFields);

    emitToConversation(conversationId, "conversation:members-updated", {
      conversation,
    });

    emitToUser(userId, "conversation:removed", {
      conversationId,
    });

    return res.json({
      success: true,
      message: "Member removed successfully",
      conversation,
    });
  } catch (error) {
    console.error("Remove group member error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove group member",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Leave group
|--------------------------------------------------------------------------
*/

export async function leaveGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.userId;
    const conversationId = getConversationId(req);

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
      type: "group",
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Group conversation not found",
      });
    }

    /*
     * Don't allow the last admin to leave
     * without first transferring admin rights.
     */
    const currentUserIsAdmin = isGroupAdmin(conversation, currentUserId);

    if (currentUserIsAdmin) {
      const remainingAdmins = conversation.admins.filter(
        (id) => id.toString() !== currentUserId,
      );

      if (remainingAdmins.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Transfer admin rights before leaving the group",
        });
      }
    }

    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== currentUserId,
    );

    conversation.admins = conversation.admins.filter(
      (id) => id.toString() !== currentUserId,
    );

    /*
     * If the group has become too small,
     * remove the conversation entirely.
     */
    if (conversation.participants.length < 2) {
      await Conversation.findByIdAndDelete(conversationId);

      emitToConversation(conversationId, "conversation:deleted", {
        conversationId,
      });

      return res.json({
        success: true,
        message: "Group left successfully",
        deleted: true,
      });
    }

    await conversation.save();

    await conversation.populate("participants", participantFields);

    emitToConversation(conversationId, "conversation:members-updated", {
      conversation,
    });

    return res.json({
      success: true,
      message: "Group left successfully",
      deleted: false,
    });
  } catch (error) {
    console.error("Leave group error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to leave group",
    });
  }
}
