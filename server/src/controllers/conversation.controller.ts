import { Response } from "express";
import mongoose from "mongoose";

import Conversation, { type IConversation } from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

import { createMessage } from "../services/message.service.js";
import {
  addUsersToConversationRoom,
  emitToConversation,
  emitToUser,
  removeUsersFromConversationRoom,
} from "../services/socket.service.js";
import { uploadSquareImage } from "../services/upload.service.js";

const participantFields =
  "name username email avatar bio isVerified isOnline lastSeen";

const MAX_GROUP_MEMBERS = 100;

const DEFAULT_MESSAGE_PAGE_SIZE = 40;

const MAX_MESSAGE_PAGE_SIZE = 100;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function param(req: AuthenticatedRequest, name: string) {
  const value = req.params[name];

  return Array.isArray(value) ? value[0] : value;
}

function requireUserId(req: AuthenticatedRequest) {
  if (!req.userId) {
    throw new HttpError(401, "Authentication required");
  }

  return req.userId;
}

function requireObjectId(value: unknown, label: string) {
  if (typeof value !== "string" || !mongoose.Types.ObjectId.isValid(value)) {
    throw new HttpError(400, `Invalid ${label}`);
  }

  return value;
}

function isGroupAdmin(conversation: IConversation, userId: string) {
  return conversation.admins.some((adminId) => adminId.toString() === userId);
}

function hasParticipant(conversation: IConversation, userId: string) {
  return conversation.participants.some((id) => id.toString() === userId);
}

function sendError(res: Response, error: unknown, label: string) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error(`${label} error:`, error);

  return res.status(500).json({
    success: false,
    message: `Failed to ${label.toLowerCase()}`,
  });
}

function populateConversation(conversation: IConversation) {
  return conversation.populate([
    { path: "participants", select: participantFields },
    { path: "lastMessage" },
  ]);
}

/*
 * Group lookups shared by every group endpoint.
 * Throws a 404 if the user is not a member, and
 * a 403 if `adminOnly` and they are not an admin.
 */
async function findGroupForUser(
  conversationId: string,
  userId: string,
  adminOnly = false,
  action = "manage this group",
) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "group",
    participants: userId,
  });

  if (!conversation) {
    throw new HttpError(404, "Group conversation not found");
  }

  if (adminOnly && !isGroupAdmin(conversation, userId)) {
    throw new HttpError(403, `Only group admins can ${action}`);
  }

  return conversation;
}

function parseUserIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Participant IDs must be an array");
  }

  const ids = value.map((id) => String(id));

  const unique = [...new Set(ids)];

  if (unique.length !== ids.length) {
    throw new HttpError(400, "Duplicate participant IDs are not allowed");
  }

  if (!unique.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw new HttpError(400, "One or more participant IDs are invalid");
  }

  return unique;
}

async function assertUsersExist(userIds: string[]) {
  const count = await User.countDocuments({ _id: { $in: userIds } });

  if (count !== userIds.length) {
    throw new HttpError(404, "One or more users were not found");
  }
}

function cleanGroupName(name: unknown) {
  if (typeof name !== "string" || !name.trim()) {
    throw new HttpError(400, "Group name is required");
  }

  const clean = name.trim();

  if (clean.length > 100) {
    throw new HttpError(400, "Group name cannot exceed 100 characters");
  }

  return clean;
}

/*
 * Broadcasts a changed group to its members.
 */
async function broadcastGroupUpdate(conversation: IConversation) {
  await populateConversation(conversation);

  emitToConversation(
    conversation._id.toString(),
    "conversation:updated",
    conversation,
  );

  return conversation;
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
    const currentUserId = requireUserId(req);

    const targetUserId = requireObjectId(req.body?.userId, "user ID");

    if (targetUserId === currentUserId) {
      throw new HttpError(400, "You cannot start a conversation with yourself");
    }

    const targetExists = await User.exists({ _id: targetUserId });

    if (!targetExists) {
      throw new HttpError(404, "User not found");
    }

    let conversation = await Conversation.findOne({
      type: "direct",
      participants: {
        $all: [currentUserId, targetUserId],
        $size: 2,
      },
    });

    const isNew = !conversation;

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [currentUserId, targetUserId],
        admins: [],
      });
    }

    await populateConversation(conversation);

    if (isNew) {
      const conversationId = conversation._id.toString();

      addUsersToConversationRoom(
        [currentUserId, targetUserId],
        conversationId,
      );

      emitToUser(targetUserId, "conversation:new", conversation);
    }

    return res.status(isNew ? 201 : 200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Create conversation");
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
    const currentUserId = requireUserId(req);

    const name = cleanGroupName(req.body?.name);

    const memberIds = parseUserIds(req.body?.participantIds);

    if (memberIds.includes(currentUserId)) {
      throw new HttpError(400, "You do not need to add yourself as a participant");
    }

    if (memberIds.length < 2) {
      throw new HttpError(400, "A group must contain at least 3 members");
    }

    if (memberIds.length + 1 > MAX_GROUP_MEMBERS) {
      throw new HttpError(
        400,
        `A group cannot contain more than ${MAX_GROUP_MEMBERS} members`,
      );
    }

    await assertUsersExist(memberIds);

    const conversation = await Conversation.create({
      type: "group",
      participants: [currentUserId, ...memberIds],
      admins: [currentUserId],
      name,
    });

    await populateConversation(conversation);

    const conversationId = conversation._id.toString();

    addUsersToConversationRoom([currentUserId, ...memberIds], conversationId);

    for (const memberId of memberIds) {
      emitToUser(memberId, "conversation:new", conversation);
    }

    return res.status(201).json({
      success: true,
      message: "Group conversation created successfully",
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Create group conversation");
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
    const currentUserId = requireUserId(req);

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate("participants", participantFields)
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    const userObjectId = new mongoose.Types.ObjectId(currentUserId);

    const unread = await Message.aggregate<{
      _id: mongoose.Types.ObjectId;
      count: number;
    }>([
      {
        $match: {
          conversation: { $in: conversations.map((c) => c._id) },
          sender: { $ne: userObjectId },
          readBy: { $ne: userObjectId },
          deleted: false,
        },
      },
      {
        $group: {
          _id: "$conversation",
          count: { $sum: 1 },
        },
      },
    ]);

    const unreadByConversation = new Map(
      unread.map((item) => [item._id.toString(), item.count]),
    );

    return res.json({
      success: true,
      conversations: conversations.map((conversation) => ({
        ...conversation.toObject(),
        unreadCount: unreadByConversation.get(conversation._id.toString()) || 0,
      })),
    });
  } catch (error) {
    return sendError(res, error, "Get conversations");
  }
}

/*
|--------------------------------------------------------------------------
| Get messages (cursor paginated, oldest first)
|--------------------------------------------------------------------------
|
| GET /:conversationId/messages?before=<messageId>&limit=40
*/

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const isMember = await Conversation.exists({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!isMember) {
      throw new HttpError(404, "Conversation not found");
    }

    const requestedLimit = Number(req.query.limit);

    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_MESSAGE_PAGE_SIZE)
        : DEFAULT_MESSAGE_PAGE_SIZE;

    const filter: Record<string, unknown> = { conversation: conversationId };

    const before = req.query.before;

    if (before !== undefined) {
      const beforeId = requireObjectId(before, "cursor");

      const cursor = await Message.findOne({
        _id: beforeId,
        conversation: conversationId,
      }).select("createdAt");

      if (!cursor) {
        throw new HttpError(400, "Invalid cursor");
      }

      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ];
    }

    const page = await Message.find(filter)
      .populate("sender", participantFields)
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: participantFields },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = page.length > limit;

    const messages = page.slice(0, limit).reverse();

    return res.json({
      success: true,
      messages,
      hasMore,
    });
  } catch (error) {
    return sendError(res, error, "Get messages");
  }
}

/*
|--------------------------------------------------------------------------
| Send message (REST fallback for the socket event)
|--------------------------------------------------------------------------
*/

export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const { content, replyTo, attachments } = req.body ?? {};

    let message;

    try {
      message = await createMessage({
        conversationId,
        userId: currentUserId,
        content: typeof content === "string" ? content : "",
        replyTo,
        attachments: Array.isArray(attachments) ? attachments : [],
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Failed to send message",
      );
    }

    emitToConversation(conversationId, "message:new", message);

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    return sendError(res, error, "Send message");
  }
}

/*
|--------------------------------------------------------------------------
| Group details
|--------------------------------------------------------------------------
*/

export async function getGroupMembers(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const conversation = await findGroupForUser(conversationId, currentUserId);

    await conversation.populate("participants", participantFields);

    return res.json({
      success: true,
      members: conversation.participants,
      admins: conversation.admins.map((id) => id.toString()),
    });
  } catch (error) {
    return sendError(res, error, "Get group members");
  }
}

export async function updateGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const conversation = await findGroupForUser(
      conversationId,
      currentUserId,
      true,
      "edit the group",
    );

    if (req.body?.name !== undefined) {
      conversation.name = cleanGroupName(req.body.name);
    }

    await conversation.save();

    await broadcastGroupUpdate(conversation);

    return res.json({
      success: true,
      message: "Group updated successfully",
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Update group");
  }
}

export async function updateGroupAvatar(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const conversation = await findGroupForUser(
      conversationId,
      currentUserId,
      true,
      "change the group photo",
    );

    const file = req.file;

    if (!file || !file.mimetype.startsWith("image/")) {
      throw new HttpError(400, "Please upload an image");
    }

    const uploaded = await uploadSquareImage(file.buffer, "tong/groups");

    conversation.avatar = uploaded.url;

    await conversation.save();

    await broadcastGroupUpdate(conversation);

    return res.json({
      success: true,
      message: "Group photo updated",
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Update group photo");
  }
}

/*
|--------------------------------------------------------------------------
| Members
|--------------------------------------------------------------------------
*/

export async function addGroupMembers(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const requestedIds = parseUserIds(
      req.body?.participantIds ?? req.body?.userIds,
    );

    if (requestedIds.length === 0) {
      throw new HttpError(400, "At least one participant is required");
    }

    const conversation = await findGroupForUser(
      conversationId,
      currentUserId,
      true,
      "add members",
    );

    const idsToAdd = requestedIds.filter(
      (id) => !hasParticipant(conversation, id),
    );

    if (idsToAdd.length === 0) {
      throw new HttpError(400, "All selected users are already members");
    }

    if (conversation.participants.length + idsToAdd.length > MAX_GROUP_MEMBERS) {
      throw new HttpError(
        400,
        `A group cannot contain more than ${MAX_GROUP_MEMBERS} members`,
      );
    }

    await assertUsersExist(idsToAdd);

    conversation.participants.push(
      ...idsToAdd.map((id) => new mongoose.Types.ObjectId(id)),
    );

    await conversation.save();

    addUsersToConversationRoom(idsToAdd, conversationId);

    await broadcastGroupUpdate(conversation);

    for (const userId of idsToAdd) {
      emitToUser(userId, "conversation:new", conversation);
    }

    return res.json({
      success: true,
      message: "Members added successfully",
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Add group members");
  }
}

export async function removeGroupMember(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const userId = requireObjectId(param(req, "userId"), "user ID");

    if (userId === currentUserId) {
      throw new HttpError(400, "Use the leave group action to remove yourself");
    }

    const conversation = await findGroupForUser(
      conversationId,
      currentUserId,
      true,
      "remove members",
    );

    if (!hasParticipant(conversation, userId)) {
      throw new HttpError(404, "User is not a group member");
    }

    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== userId,
    );

    conversation.admins = conversation.admins.filter(
      (id) => id.toString() !== userId,
    );

    await conversation.save();

    removeUsersFromConversationRoom([userId], conversationId);

    emitToUser(userId, "conversation:removed", { conversationId });

    await broadcastGroupUpdate(conversation);

    return res.json({
      success: true,
      message: "Member removed successfully",
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Remove group member");
  }
}

/*
|--------------------------------------------------------------------------
| Admins
|--------------------------------------------------------------------------
*/

export async function promoteGroupAdmin(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const userId = requireObjectId(param(req, "userId"), "user ID");

    const conversation = await findGroupForUser(
      conversationId,
      currentUserId,
      true,
      "manage admins",
    );

    if (!hasParticipant(conversation, userId)) {
      throw new HttpError(404, "User is not a group member");
    }

    if (!isGroupAdmin(conversation, userId)) {
      conversation.admins.push(new mongoose.Types.ObjectId(userId));

      await conversation.save();
    }

    await broadcastGroupUpdate(conversation);

    return res.json({
      success: true,
      message: "Member is now an admin",
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Promote admin");
  }
}

export async function demoteGroupAdmin(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const userId = requireObjectId(param(req, "userId"), "user ID");

    const conversation = await findGroupForUser(
      conversationId,
      currentUserId,
      true,
      "manage admins",
    );

    if (!isGroupAdmin(conversation, userId)) {
      throw new HttpError(400, "This member is not an admin");
    }

    if (conversation.admins.length === 1) {
      throw new HttpError(400, "A group needs at least one admin");
    }

    conversation.admins = conversation.admins.filter(
      (id) => id.toString() !== userId,
    );

    await conversation.save();

    await broadcastGroupUpdate(conversation);

    return res.json({
      success: true,
      message: "Admin rights removed",
      conversation,
    });
  } catch (error) {
    return sendError(res, error, "Remove admin");
  }
}

/*
|--------------------------------------------------------------------------
| Leave group
|--------------------------------------------------------------------------
|
| If the last admin leaves, the longest-standing
| remaining member becomes admin. The group is
| deleted once nobody is left.
*/

export async function leaveGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = requireUserId(req);

    const conversationId = requireObjectId(
      param(req, "conversationId"),
      "conversation ID",
    );

    const conversation = await findGroupForUser(conversationId, currentUserId);

    conversation.participants = conversation.participants.filter(
      (id) => id.toString() !== currentUserId,
    );

    conversation.admins = conversation.admins.filter(
      (id) => id.toString() !== currentUserId,
    );

    removeUsersFromConversationRoom([currentUserId], conversationId);

    emitToUser(currentUserId, "conversation:removed", { conversationId });

    if (conversation.participants.length === 0) {
      await Message.deleteMany({ conversation: conversationId });

      await conversation.deleteOne();

      return res.json({
        success: true,
        message: "Group left successfully",
        deleted: true,
      });
    }

    if (conversation.admins.length === 0) {
      conversation.admins = [conversation.participants[0]];
    }

    await conversation.save();

    await broadcastGroupUpdate(conversation);

    return res.json({
      success: true,
      message: "Group left successfully",
      deleted: false,
    });
  } catch (error) {
    return sendError(res, error, "Leave group");
  }
}
