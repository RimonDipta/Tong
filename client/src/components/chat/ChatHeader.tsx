import { ArrowLeft, Info } from "lucide-react";

import { getTypingText, pluralize } from "../../lib/chat";
import type { Conversation } from "../../types/chat";

import Avatar from "../ui/Avatar";

interface ChatHeaderProps {
  conversation: Conversation;
  title: string;
  avatar?: string;
  online: boolean;
  statusText: string;
  typingNames: string[];
  onBack: () => void;
  onOpenInfo: () => void;
}

export default function ChatHeader({
  conversation,
  title,
  avatar,
  online,
  statusText,
  typingNames,
  onBack,
  onOpenInfo,
}: ChatHeaderProps) {
  const isGroup = conversation.type === "group";

  const subtitle =
    typingNames.length > 0
      ? isGroup
        ? getTypingText(typingNames)
        : "typing…"
      : isGroup
        ? pluralize(conversation.participants.length, "member")
        : statusText;

  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-zinc-800/70 bg-[var(--surface)] px-2 sm:px-4">
      <button
        type="button"
        onClick={onBack}
        className="icon-btn md:hidden"
        aria-label="Back to chats"
      >
        <ArrowLeft size={19} />
      </button>

      <button
        type="button"
        onClick={onOpenInfo}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-zinc-900"
      >
        <Avatar
          name={title}
          src={avatar}
          group={isGroup && !avatar}
          online={!isGroup && online}
        />

        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-zinc-100">
            {title}
          </span>

          <span
            className={`block truncate text-xs ${
              typingNames.length > 0
                ? "text-emerald-400"
                : online && !isGroup
                  ? "text-zinc-300"
                  : "text-zinc-500"
            }`}
          >
            {subtitle}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenInfo}
        className="icon-btn"
        aria-label={isGroup ? "Group info" : "Contact info"}
        title={isGroup ? "Group info" : "Contact info"}
      >
        <Info size={19} />
      </button>
    </header>
  );
}
