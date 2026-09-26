import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";

import { connectDatabase } from "./config/database.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import avatarRoutes from "./routes/avatar.routes.js";

import Conversation from "./models/Conversation.js";
import User from "./models/User.js";

import { verifyAccessToken } from "./utils/token.js";

import {
  createMessage,
  editMessage,
  deleteMessage,
} from "./services/message.service.js";

import { markConversationAsRead } from "./services/read.service.js";
import { toggleReaction } from "./services/reaction.service.js";

const app = express();

const httpServer = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

const onlineUsers = new Map<string, Set<string>>();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/conversations", conversationRoutes);

app.use("/api/uploads", uploadRoutes);

app.use("/api/avatar", avatarRoutes);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (_req, res) => {
  return res.json({
    success: true,
    message: "Tong server is running",
  });
});

/*
|--------------------------------------------------------------------------
| Socket Authentication
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Socket Connection
|--------------------------------------------------------------------------
*/

io.on("connection", async (socket) => {
  const userId = socket.data.userId as string;

  console.log(`Socket connected: ${socket.id} | User: ${userId}`);

  const userSockets = onlineUsers.get(userId) || new Set<string>();

  const wasOffline = userSockets.size === 0;

  userSockets.add(socket.id);

  onlineUsers.set(userId, userSockets);

  if (wasOffline) {
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
      });

      io.emit("presence:update", {
        userId,
        isOnline: true,
      });
    } catch (error) {
      console.error("Failed to update online status:", error);
    }
  }

  socket.emit("presence:initial", {
    userIds: Array.from(onlineUsers.keys()),
  });

  /*
    |--------------------------------------------------------------------------
    | Conversation Join
    |--------------------------------------------------------------------------
    */

  socket.on("conversation:join", async (conversationId: string) => {
    try {
      if (!conversationId) {
        return;
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        socket.emit("conversation:error", {
          message: "You are not a member of this conversation",
        });

        return;
      }

      const room = `conversation:${conversationId}`;

      socket.join(room);

      console.log(`User ${userId} joined ${room}`);
    } catch (error) {
      console.error("Conversation join error:", error);

      socket.emit("conversation:error", {
        message: "Failed to join conversation",
      });
    }
  });

  /*
    |--------------------------------------------------------------------------
    | Conversation Leave
    |--------------------------------------------------------------------------
    */

  socket.on("conversation:leave", (conversationId: string) => {
    if (!conversationId) {
      return;
    }

    const room = `conversation:${conversationId}`;

    socket.leave(room);

    console.log(`User ${userId} left ${room}`);
  });

  /*
    |--------------------------------------------------------------------------
    | Send Message
    |--------------------------------------------------------------------------
    */

  socket.on(
    "message:send",
    async (
      data: {
        conversationId: string;

        content: string;

        replyTo?: string;

        attachments?: {
          url: string;
          name: string;
          type: string;
          size: number;
          publicId?: string;
          resourceType?: string;
        }[];
      },

      callback?: (response: {
        success: boolean;
        message?: unknown;
        error?: string;
      }) => void,
    ) => {
      try {
        if (!data?.conversationId) {
          callback?.({
            success: false,
            error: "Conversation ID is required",
          });

          return;
        }

        const content = typeof data.content === "string" ? data.content : "";

        const attachments = Array.isArray(data.attachments)
          ? data.attachments
          : [];

        if (!content.trim() && attachments.length === 0) {
          callback?.({
            success: false,
            error: "Message cannot be empty",
          });

          return;
        }

        if (attachments.length > 5) {
          callback?.({
            success: false,
            error: "You can attach a maximum of 5 files",
          });

          return;
        }

        const message = await createMessage({
          conversationId: data.conversationId,

          userId,

          content,

          replyTo: data.replyTo,

          attachments,
        });

        const room = `conversation:${data.conversationId}`;

        io.to(room).emit("message:new", message);

        callback?.({
          success: true,
          message,
        });

        console.log(`Message sent by ${userId} in ${data.conversationId}`);
      } catch (error) {
        console.error("Socket message error:", error);

        callback?.({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    },
  );

  /*
    |--------------------------------------------------------------------------
    | Edit Message
    |--------------------------------------------------------------------------
    */

  socket.on(
    "message:edit",
    async (
      data: {
        messageId: string;
        content: string;
      },

      callback?: (response: {
        success: boolean;
        message?: unknown;
        error?: string;
      }) => void,
    ) => {
      try {
        if (!data?.messageId) {
          callback?.({
            success: false,
            error: "Message ID is required",
          });

          return;
        }

        if (typeof data.content !== "string" || !data.content.trim()) {
          callback?.({
            success: false,
            error: "Message cannot be empty",
          });

          return;
        }

        const message = await editMessage({
          messageId: data.messageId,

          userId,

          content: data.content,
        });

        const conversationId = message.conversation.toString();

        io.to(`conversation:${conversationId}`).emit("message:edited", message);

        callback?.({
          success: true,
          message,
        });
      } catch (error) {
        console.error("Message edit error:", error);

        callback?.({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to edit message",
        });
      }
    },
  );

  /*
    |--------------------------------------------------------------------------
    | Delete Message
    |--------------------------------------------------------------------------
    */

  socket.on(
    "message:delete",
    async (
      data: {
        messageId: string;
      },

      callback?: (response: {
        success: boolean;
        message?: unknown;
        error?: string;
      }) => void,
    ) => {
      try {
        if (!data?.messageId) {
          callback?.({
            success: false,
            error: "Message ID is required",
          });

          return;
        }

        const message = await deleteMessage({
          messageId: data.messageId,

          userId,
        });

        const conversationId = message.conversation.toString();

        io.to(`conversation:${conversationId}`).emit(
          "message:deleted",
          message,
        );

        callback?.({
          success: true,
          message,
        });
      } catch (error) {
        console.error("Message delete error:", error);

        callback?.({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete message",
        });
      }
    },
  );

  /*
    |--------------------------------------------------------------------------
    | Mark Conversation As Read
    |--------------------------------------------------------------------------
    */

  socket.on("conversation:read", async (conversationId: string) => {
    try {
      if (!conversationId) {
        return;
      }

      const messageIds = await markConversationAsRead({
        conversationId,
        userId,
      });

      if (messageIds.length === 0) {
        return;
      }

      io.to(`conversation:${conversationId}`).emit("message:read", {
        conversationId,
        messageIds,
        userId,
      });
    } catch (error) {
      console.error("Mark messages as read error:", error);
    }
  });

  /*
    |--------------------------------------------------------------------------
    | Reactions
    |--------------------------------------------------------------------------
    */

  socket.on(
    "message:reaction",
    async (
      data: {
        messageId: string;
        emoji: string;
      },

      callback?: (response: {
        success: boolean;
        message?: unknown;
        error?: string;
      }) => void,
    ) => {
      try {
        if (!data?.messageId) {
          callback?.({
            success: false,
            error: "Message ID is required",
          });

          return;
        }

        if (!data?.emoji) {
          callback?.({
            success: false,
            error: "Reaction is required",
          });

          return;
        }

        const message = await toggleReaction({
          messageId: data.messageId,

          userId,

          emoji: data.emoji,
        });

        const conversationId = message.conversation.toString();

        io.to(`conversation:${conversationId}`).emit("message:reaction", {
          message,
        });

        callback?.({
          success: true,
          message,
        });
      } catch (error) {
        console.error("Message reaction error:", error);

        callback?.({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update reaction",
        });
      }
    },
  );

  /*
    |--------------------------------------------------------------------------
    | Typing
    |--------------------------------------------------------------------------
    */

  socket.on("typing:start", async (conversationId: string) => {
    try {
      if (!conversationId) {
        return;
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        return;
      }

      socket.to(`conversation:${conversationId}`).emit("typing:start", {
        conversationId,
        userId,
      });
    } catch {
      // Ignore typing errors.
    }
  });

  socket.on("typing:stop", async (conversationId: string) => {
    try {
      if (!conversationId) {
        return;
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        return;
      }

      socket.to(`conversation:${conversationId}`).emit("typing:stop", {
        conversationId,
        userId,
      });
    } catch {
      // Ignore typing errors.
    }
  });

  /*
    |--------------------------------------------------------------------------
    | Disconnect
    |--------------------------------------------------------------------------
    */

  socket.on("disconnect", async (reason) => {
    console.log(`Socket disconnected: ${socket.id} | ${reason}`);

    const sockets = onlineUsers.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socket.id);

    if (sockets.size > 0) {
      return;
    }

    onlineUsers.delete(userId);

    const lastSeen = new Date();

    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen,
      });

      io.emit("presence:update", {
        userId,
        isOnline: false,
        lastSeen: lastSeen.toISOString(),
      });
    } catch (error) {
      console.error("Failed to update offline status:", error);
    }
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();

  httpServer.listen(PORT, () => {
    console.log(`Tong server running on http://localhost:${PORT}`);
  });
}

startServer();
