import type { Server } from "socket.io";

let io: Server | null = null;

export function initializeSocketService(socketServer: Server) {
  io = socketServer;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}

export function conversationRoom(conversationId: string) {
  return `conversation:${conversationId}`;
}

/*
 * Every socket a user opens joins their personal
 * room, so emitting to the room reaches all of
 * that user's tabs and devices.
 */
export function emitToUser(userId: string, event: string, data: unknown) {
  io?.to(userRoom(userId)).emit(event, data);
}

export function emitToConversation(
  conversationId: string,
  event: string,
  data: unknown,
) {
  io?.to(conversationRoom(conversationId)).emit(event, data);
}

export function addUsersToConversationRoom(
  userIds: string[],
  conversationId: string,
) {
  if (!io || userIds.length === 0) {
    return;
  }

  io.in(userIds.map(userRoom)).socketsJoin(conversationRoom(conversationId));
}

export function removeUsersFromConversationRoom(
  userIds: string[],
  conversationId: string,
) {
  if (!io || userIds.length === 0) {
    return;
  }

  io.in(userIds.map(userRoom)).socketsLeave(conversationRoom(conversationId));
}
