import type { User } from "./auth";

export interface MessageAttachment {
  url: string;

  name: string;

  type: string;

  size: number;

  publicId?: string;

  resourceType?: string;
}

export interface Message {
  _id: string;

  conversation: string;

  sender: User;

  content: string;

  attachments: MessageAttachment[];

  replyTo?: Message;

  reactions: {
    user: string;
    emoji: string;
  }[];

  readBy: string[];

  edited: boolean;

  deleted: boolean;

  createdAt: string;

  updatedAt: string;
}

export interface Conversation {
  _id: string;

  type: "direct" | "group";

  participants: User[];

  admins: string[];

  name?: string;

  avatar?: string;

  lastMessage?: Message;

  unreadCount?: number;

  createdAt: string;

  updatedAt: string;
}
