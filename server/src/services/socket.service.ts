import type { Server, Socket } from "socket.io";

let io: Server | null = null;

const onlineUsers = new Map<string, string>();

export function initializeSocketService(socketServer: Server) {
  io = socketServer;
}

export function registerUserSocket(userId: string, socketId: string) {
  onlineUsers.set(userId, socketId);
}

export function unregisterUserSocket(userId: string, socketId: string) {
  const currentSocketId = onlineUsers.get(userId);

  if (currentSocketId === socketId) {
    onlineUsers.delete(userId);
  }
}

export function getUserSocketId(userId: string) {
  return onlineUsers.get(userId);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  if (!io) {
    return;
  }

  const socketId = getUserSocketId(userId);

  if (!socketId) {
    return;
  }

  io.to(socketId).emit(event, data);
}

export function emitToConversation(
  conversationId: string,
  event: string,
  data: unknown,
) {
  if (!io) {
    return;
  }

  io.to(`conversation:${conversationId}`).emit(event, data);
}

export function getOnlineUsers() {
  return onlineUsers;
}
