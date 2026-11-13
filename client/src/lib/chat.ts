import type { User } from "../types/auth";
import type { Conversation, Message } from "../types/chat";

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export const MAX_ATTACHMENTS = 5;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
].join(",");

export function getUserId(user?: User | null) {
  return user?._id || user?.id || "";
}

export function getOtherParticipant(
  conversation: Conversation,
  currentUserId: string,
) {
  return conversation.participants.find(
    (user) => getUserId(user) !== currentUserId,
  );
}

export function getConversationTitle(
  conversation: Conversation,
  currentUserId: string,
) {
  if (conversation.type === "group") {
    return conversation.name || "Untitled group";
  }

  const other = getOtherParticipant(conversation, currentUserId);

  return other?.name || other?.username || "Deleted user";
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function getMessagePreview(message?: Message, currentUserId?: string) {
  if (!message) {
    return "No messages yet";
  }

  if (message.deleted) {
    return "Message deleted";
  }

  const text =
    message.content ||
    (message.attachments?.length
      ? message.attachments.every((file) => file.type.startsWith("image/"))
        ? message.attachments.length > 1
          ? `${message.attachments.length} photos`
          : "Photo"
        : message.attachments[0].name
      : "Message");

  const senderId =
    typeof message.sender === "string"
      ? message.sender
      : getUserId(message.sender);

  return senderId && senderId === currentUserId ? `You: ${text}` : text;
}

export function isSameDay(a: string | Date, b: string | Date) {
  const first = new Date(a);
  const second = new Date(b);

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/*
 * Sidebar timestamp: time today, weekday this week,
 * otherwise a short date.
 */
export function formatListTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();

  if (isSameDay(date, now)) {
    return formatTime(value);
  }

  const daysAgo = (now.getTime() - date.getTime()) / 86_400_000;

  if (daysAgo < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatDayDivider(value: string) {
  const date = new Date(value);
  const now = new Date();

  if (isSameDay(date, now)) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatLastSeen(lastSeen?: string) {
  if (!lastSeen) {
    return "Offline";
  }

  const minutes = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60_000);

  if (minutes < 1) {
    return "Last seen just now";
  }

  if (minutes < 60) {
    return `Last seen ${minutes}m ago`;
  }

  if (minutes < 60 * 24 && isSameDay(lastSeen, new Date())) {
    return `Last seen today at ${formatTime(lastSeen)}`;
  }

  return `Last seen ${formatListTimestamp(lastSeen)}`;
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function groupReactions(message: Message, currentUserId: string) {
  const groups = new Map<string, { count: number; mine: boolean }>();

  for (const reaction of message.reactions || []) {
    const entry = groups.get(reaction.emoji) || { count: 0, mine: false };

    entry.count += 1;

    if (String(reaction.user) === currentUserId) {
      entry.mine = true;
    }

    groups.set(reaction.emoji, entry);
  }

  return Array.from(groups.entries()).map(([emoji, entry]) => ({
    emoji,
    ...entry,
  }));
}

export function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getTypingText(names: string[]) {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return `${names[0]} is typing…`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing…`;
  }

  return `${names[0]} and ${names.length - 1} others are typing…`;
}

/*
 * Validates newly picked files against the
 * attachment limits before adding them.
 */
export function mergeFiles(existing: File[], incoming: File[]) {
  const combined = [...existing, ...incoming];

  if (combined.length > MAX_ATTACHMENTS) {
    return {
      files: existing,
      error: `You can attach up to ${MAX_ATTACHMENTS} files per message.`,
    };
  }

  const tooBig = incoming.find((file) => file.size > MAX_FILE_SIZE);

  if (tooBig) {
    return {
      files: existing,
      error: `${tooBig.name} is over 10 MB.`,
    };
  }

  const unsupported = incoming.find(
    (file) => !ACCEPTED_FILE_TYPES.split(",").includes(file.type),
  );

  if (unsupported) {
    return {
      files: existing,
      error: `${unsupported.name} isn't a supported file type.`,
    };
  }

  return { files: combined, error: "" };
}
