import { LogOut, MessageSquarePlus, Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  formatListTimestamp,
  getConversationTitle,
  getMessagePreview,
  getOtherParticipant,
  getUserId,
} from "../../lib/chat";
import type { User } from "../../types/auth";
import type { Conversation } from "../../types/chat";

import Avatar from "../ui/Avatar";

type Filter = "all" | "unread" | "groups";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
];

interface ConversationListProps {
  user: User | null;
  conversations: Conversation[];
  selectedId: string | null;
  loading: boolean;
  isOnline: (user?: User) => boolean;
  typingByConversation: Record<string, string[]>;
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onLogout: () => void;
}

export default function ConversationList({
  user,
  conversations,
  selectedId,
  loading,
  isOnline,
  typingByConversation,
  onSelect,
  onNewChat,
  onNewGroup,
  onLogout,
}: ConversationListProps) {
  const currentUserId = getUserId(user);

  const [query, setQuery] = useState("");

  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (filter === "unread" && !conversation.unreadCount) {
        return false;
      }

      if (filter === "groups" && conversation.type !== "group") {
        return false;
      }

      if (!needle) {
        return true;
      }

      const title = getConversationTitle(conversation, currentUserId);
      const other = getOtherParticipant(conversation, currentUserId);

      return (
        title.toLowerCase().includes(needle) ||
        Boolean(other?.username?.toLowerCase().includes(needle))
      );
    });
  }, [conversations, currentUserId, filter, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
          Chats
        </h1>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewGroup}
            className="icon-btn"
            aria-label="New group"
            title="New group"
          >
            <Users size={18} />
          </button>

          <button
            type="button"
            onClick={onNewChat}
            className="icon-btn"
            aria-label="New message"
            title="New message"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <label htmlFor="conversation-search" className="sr-only">
          Search chats
        </label>

        <div className="field flex items-center gap-2 px-3">
          <Search size={15} className="shrink-0 text-zinc-500" aria-hidden />

          <input
            id="conversation-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-zinc-500 hover:text-zinc-200"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mt-2 flex gap-1" role="tablist" aria-label="Filter chats">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`h-7 rounded-full px-3 text-xs font-medium transition ${
                filter === item.id
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Conversations">
        {loading ? (
          <ListSkeleton />
        ) : visible.length === 0 ? (
          <EmptyList
            hasConversations={conversations.length > 0}
            onNewChat={onNewChat}
          />
        ) : (
          <ul className="space-y-0.5">
            {visible.map((conversation) => (
              <li key={conversation._id}>
                <ConversationRow
                  conversation={conversation}
                  currentUserId={currentUserId}
                  selected={conversation._id === selectedId}
                  isOnline={isOnline}
                  typingNames={typingByConversation[conversation._id] || []}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="flex items-center gap-2 border-t border-zinc-800/70 p-2">
        <Link
          to="/profile"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-zinc-900"
        >
          <Avatar name={user?.name} src={user?.avatar} size="sm" />

          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-200">
              {user?.name}
            </span>
            <span className="block truncate text-xs text-zinc-500">
              @{user?.username}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="icon-btn"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  currentUserId,
  selected,
  isOnline,
  typingNames,
  onSelect,
}: {
  conversation: Conversation;
  currentUserId: string;
  selected: boolean;
  isOnline: (user?: User) => boolean;
  typingNames: string[];
  onSelect: (conversationId: string) => void;
}) {
  const isGroup = conversation.type === "group";

  const other = isGroup
    ? undefined
    : getOtherParticipant(conversation, currentUserId);

  const title = getConversationTitle(conversation, currentUserId);

  const unread = conversation.unreadCount || 0;

  const typing =
    typingNames.length > 0
      ? isGroup
        ? `${typingNames[0]} is typing…`
        : "typing…"
      : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation._id)}
      aria-current={selected ? "page" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
        selected ? "bg-zinc-800/70" : "hover:bg-zinc-900"
      }`}
    >
      <Avatar
        name={title}
        src={conversation.avatar || other?.avatar}
        group={isGroup && !conversation.avatar}
        online={!isGroup && isOnline(other)}
        size="lg"
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm ${
              unread ? "font-semibold text-zinc-50" : "font-medium text-zinc-200"
            }`}
          >
            {title}
          </span>

          {conversation.lastMessage && (
            <span
              className={`shrink-0 text-[11px] ${
                unread ? "font-medium text-zinc-200" : "text-zinc-500"
              }`}
            >
              {formatListTimestamp(conversation.lastMessage.createdAt)}
            </span>
          )}
        </span>

        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={`truncate text-[13px] ${
              typing
                ? "text-emerald-400"
                : unread
                  ? "text-zinc-300"
                  : "text-zinc-500"
            }`}
          >
            {typing ||
              getMessagePreview(conversation.lastMessage, currentUserId)}
          </span>

          {unread > 0 && (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-900"
              aria-label={`${unread} unread`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-1 px-1 pt-1" aria-label="Loading chats">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 px-2 py-2.5">
          <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-zinc-900" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/2 animate-pulse rounded bg-zinc-900" />
            <span className="block h-3 w-3/4 animate-pulse rounded bg-zinc-900" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyList({
  hasConversations,
  onNewChat,
}: {
  hasConversations: boolean;
  onNewChat: () => void;
}) {
  if (hasConversations) {
    return (
      <p className="px-6 py-12 text-center text-sm text-zinc-500">
        No chats match.
      </p>
    );
  }

  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-300">No chats yet</p>

      <p className="mt-1 text-xs text-zinc-500">
        Find someone to start talking.
      </p>

      <button type="button" onClick={onNewChat} className="btn-primary mt-4 h-9">
        <MessageSquarePlus size={15} />
        Start a chat
      </button>
    </div>
  );
}
