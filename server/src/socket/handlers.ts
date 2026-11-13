import type { Server, Socket } from "socket.io";

import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

import { verifyAccessToken } from "../utils/token.js";

import {
  createMessage,
  deleteMessage,
  editMessage,
  type MessageAttachment,
} from "../services/message.service.js";
import { markConversationAsRead } from "../services/read.service.js";
import { toggleReaction } from "../services/reaction.service.js";
import {
  conversationRoom,
  emitToUser,
  userRoom,
} from "../services/socket.service.js";

type Ack = (response: {
  success: boolean;
  message?: unknown;
  error?: string;
}) => void;

/*
 * Tracks open sockets per user so presence only
 * flips when the first socket connects or the
 * last one disconnects.
 */
const onlineUsers = new Map<string, Set<string>>();

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/*
 * Wraps an acknowledged event so every handler
 * reports failures the same way.
 */
function withAck<T>(
  label: string,
  handler: (data: T) => Promise<unknown>,
): (data: T, callback?: Ack) => Promise<void> {
  return async (data, callback) => {
    try {
      const message = await handler(data);

      callback?.({ success: true, message });
    } catch (error) {
      console.error(`${label} error:`, error);

      callback?.({
        success: false,
        error: errorMessage(error, `Failed to ${label.toLowerCase()}`),
      });
    }
  };
}

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = verifyAccessToken(token);

      socket.data.userId = payload.userId;

      next();
    } catch {
      next(new Error("Invalid or expired access token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId as string;

    socket.join(userRoom(userId));

    /*
     * Join every conversation up front so the
     * sidebar receives new messages, typing and
     * read receipts for all chats, not just the
     * open one.
     */
    try {
      const conversations = await Conversation.find({
        participants: userId,
      }).select("_id");

      for (const conversation of conversations) {
        socket.join(conversationRoom(conversation._id.toString()));
      }
    } catch (error) {
      console.error("Failed to join conversation rooms:", error);
    }

    await markOnline(io, userId, socket.id);

    socket.emit("presence:initial", {
      userIds: Array.from(onlineUsers.keys()),
    });

    socket.on("conversation:join", async (conversationId: string) => {
      try {
        if (!conversationId) {
          return;
        }

        const isMember = await Conversation.exists({
          _id: conversationId,
          participants: userId,
        });

        if (!isMember) {
          socket.emit("conversation:error", {
            message: "You are not a member of this conversation",
          });

          return;
        }

        socket.join(conversationRoom(conversationId));
      } catch (error) {
        console.error("Conversation join error:", error);
      }
    });

    socket.on(
      "message:send",
      withAck(
        "Send message",
        async (data: {
          conversationId: string;
          content?: string;
          replyTo?: string;
          attachments?: MessageAttachment[];
        }) => {
          if (!data?.conversationId) {
            throw new Error("Conversation ID is required");
          }

          const message = await createMessage({
            conversationId: data.conversationId,
            userId,
            content: typeof data.content === "string" ? data.content : "",
            replyTo: data.replyTo,
            attachments: Array.isArray(data.attachments)
              ? data.attachments
              : [],
          });

          io.to(conversationRoom(data.conversationId)).emit(
            "message:new",
            message,
          );

          return message;
        },
      ),
    );

    socket.on(
      "message:edit",
      withAck(
        "Edit message",
        async (data: { messageId: string; content: string }) => {
          if (!data?.messageId) {
            throw new Error("Message ID is required");
          }

          if (typeof data.content !== "string") {
            throw new Error("Message cannot be empty");
          }

          const message = await editMessage({
            messageId: data.messageId,
            userId,
            content: data.content,
          });

          io.to(conversationRoom(message.conversation.toString())).emit(
            "message:edited",
            message,
          );

          return message;
        },
      ),
    );

    socket.on(
      "message:delete",
      withAck("Delete message", async (data: { messageId: string }) => {
        if (!data?.messageId) {
          throw new Error("Message ID is required");
        }

        const message = await deleteMessage({
          messageId: data.messageId,
          userId,
        });

        io.to(conversationRoom(message.conversation.toString())).emit(
          "message:deleted",
          message,
        );

        return message;
      }),
    );

    socket.on(
      "message:reaction",
      withAck(
        "Update reaction",
        async (data: { messageId: string; emoji: string }) => {
          if (!data?.messageId) {
            throw new Error("Message ID is required");
          }

          if (!data.emoji) {
            throw new Error("Reaction is required");
          }

          const message = await toggleReaction({
            messageId: data.messageId,
            userId,
            emoji: data.emoji,
          });

          io.to(conversationRoom(message.conversation.toString())).emit(
            "message:reaction",
            { message },
          );

          return message;
        },
      ),
    );

    socket.on("conversation:read", async (conversationId: string) => {
      try {
        if (!conversationId) {
          return;
        }

        const messageIds = await markConversationAsRead({
          conversationId,
          userId,
        });

        /*
         * Clear the unread badge on the user's
         * other tabs and devices.
         */
        emitToUser(userId, "conversation:read", { conversationId });

        if (messageIds.length === 0) {
          return;
        }

        io.to(conversationRoom(conversationId)).emit("message:read", {
          conversationId,
          messageIds,
          userId,
        });
      } catch (error) {
        console.error("Mark messages as read error:", error);
      }
    });

    /*
     * Typing events fire on every keystroke, so
     * check room membership in memory instead of
     * hitting the database.
     */
    for (const event of ["typing:start", "typing:stop"] as const) {
      socket.on(event, (conversationId: string) => {
        if (!conversationId) {
          return;
        }

        const room = conversationRoom(conversationId);

        if (!socket.rooms.has(room)) {
          return;
        }

        socket.to(room).emit(event, { conversationId, userId });
      });
    }

    socket.on("disconnect", async () => {
      await markOffline(io, userId, socket.id);
    });
  });
}

async function markOnline(io: Server, userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId) || new Set<string>();

  const wasOffline = sockets.size === 0;

  sockets.add(socketId);

  onlineUsers.set(userId, sockets);

  if (!wasOffline) {
    return;
  }

  try {
    await User.findByIdAndUpdate(userId, { isOnline: true });

    io.emit("presence:update", { userId, isOnline: true });
  } catch (error) {
    console.error("Failed to update online status:", error);
  }
}

async function markOffline(io: Server, userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (sockets.size > 0) {
    return;
  }

  onlineUsers.delete(userId);

  const lastSeen = new Date();

  try {
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });

    io.emit("presence:update", {
      userId,
      isOnline: false,
      lastSeen: lastSeen.toISOString(),
    });
  } catch (error) {
    console.error("Failed to update offline status:", error);
  }
}
