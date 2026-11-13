import {
  ArrowDown,
  Check,
  CheckCheck,
  FileText,
  MoreHorizontal,
  Pencil,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  REACTIONS,
  formatDayDivider,
  formatFileSize,
  formatTime,
  groupReactions,
  isSameDay,
  getUserId,
} from "../../lib/chat";
import type { Conversation, Message, MessageAttachment } from "../../types/chat";

import Avatar from "../ui/Avatar";
import { Spinner } from "../ui/ConfirmDialog";

/*
 * Consecutive messages from one sender within
 * this window are visually grouped.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const NEAR_BOTTOM_PX = 120;

interface MessageListProps {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  loading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
}

type OpenMenu = { id: string; kind: "react" | "more" } | null;

export default function MessageList({
  conversation,
  messages,
  currentUserId,
  loading,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const [showJump, setShowJump] = useState(false);

  const [highlightId, setHighlightId] = useState<string | null>(null);

  const isGroup = conversation.type === "group";

  /*
   * Scroll bookkeeping. We track the first and
   * last message ids to tell "older page loaded"
   * (keep position) apart from "new message"
   * (stick to bottom if already there).
   */
  const previous = useRef({
    conversationId: "",
    firstId: "",
    lastId: "",
    scrollHeight: 0,
  });

  const wasNearBottom = useRef(true);

  const isNearBottom = useCallback(() => {
    const element = scrollRef.current;

    if (!element) {
      return true;
    }

    return (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      NEAR_BOTTOM_PX
    );
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;

    if (!element || loading) {
      return;
    }

    const firstId = messages[0]?._id || "";
    const lastId = messages[messages.length - 1]?._id || "";
    const last = messages[messages.length - 1];
    const prev = previous.current;

    if (prev.conversationId !== conversation._id || !prev.lastId) {
      scrollToBottom(false);
    } else if (firstId !== prev.firstId && lastId === prev.lastId) {
      element.scrollTop += element.scrollHeight - prev.scrollHeight;
    } else if (lastId !== prev.lastId) {
      const own = last && getUserId(last.sender) === currentUserId;

      if (own || wasNearBottom.current) {
        scrollToBottom(true);
      } else {
        setShowJump(true);
      }
    }

    previous.current = {
      conversationId: conversation._id,
      firstId,
      lastId,
      scrollHeight: element.scrollHeight,
    };
  }, [conversation._id, currentUserId, loading, messages, scrollToBottom]);

  function handleScroll() {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    wasNearBottom.current = isNearBottom();

    if (wasNearBottom.current) {
      setShowJump(false);
    }

    if (element.scrollTop < 200 && hasMore && !loadingOlder) {
      onLoadOlder();
    }
  }

  /*
   * Close popovers on outside click or Escape.
   */
  useEffect(() => {
    if (!openMenu) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest("[data-message-menu]")) {
        setOpenMenu(null);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openMenu]);

  function jumpToMessage(messageId: string) {
    const target = document.getElementById(`message-${messageId}`);

    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    setHighlightId(messageId);

    window.setTimeout(() => setHighlightId(null), 1500);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6"
        role="log"
        aria-label="Messages"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-3xl flex-col">
          {hasMore ? (
            <div className="flex justify-center py-3 text-zinc-500">
              {loadingOlder ? (
                <Spinner size={16} />
              ) : (
                <button
                  type="button"
                  onClick={onLoadOlder}
                  className="text-xs hover:text-zinc-300"
                >
                  Load earlier messages
                </button>
              )}
            </div>
          ) : messages.length > 0 ? (
            <p className="py-6 text-center text-xs text-zinc-600">
              This is the beginning of your conversation.
            </p>
          ) : null}

          {messages.length === 0 && (
            <div className="flex flex-col items-center py-24 text-center">
              <p className="text-sm font-medium text-zinc-300">No messages yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                Say hello — your first message starts the conversation.
              </p>
            </div>
          )}

          {messages.map((message, index) => {
            const prev = messages[index - 1];
            const next = messages[index + 1];

            const senderId = getUserId(message.sender);
            const own = senderId === currentUserId;

            const newDay = !prev || !isSameDay(prev.createdAt, message.createdAt);

            const continuesPrev =
              !newDay &&
              prev &&
              getUserId(prev.sender) === senderId &&
              new Date(message.createdAt).getTime() -
                new Date(prev.createdAt).getTime() <
                GROUP_WINDOW_MS;

            const continuesNext =
              next &&
              isSameDay(next.createdAt, message.createdAt) &&
              getUserId(next.sender) === senderId &&
              new Date(next.createdAt).getTime() -
                new Date(message.createdAt).getTime() <
                GROUP_WINDOW_MS;

            return (
              <Fragment key={message._id}>
                {newDay && (
                  <div className="sticky top-0 z-10 flex justify-center py-3">
                    <span className="rounded-full border border-zinc-800 bg-[var(--bg)]/90 px-3 py-1 text-[11px] font-medium text-zinc-400 backdrop-blur">
                      {formatDayDivider(message.createdAt)}
                    </span>
                  </div>
                )}

                <MessageRow
                  message={message}
                  own={own}
                  isGroup={isGroup}
                  currentUserId={currentUserId}
                  showSender={isGroup && !own && !continuesPrev}
                  showAvatar={isGroup && !own && !continuesNext}
                  compactTop={Boolean(continuesPrev)}
                  highlighted={highlightId === message._id}
                  openMenu={openMenu?.id === message._id ? openMenu.kind : null}
                  setOpenMenu={(kind) =>
                    setOpenMenu(kind ? { id: message._id, kind } : null)
                  }
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReact={onReact}
                  onJumpTo={jumpToMessage}
                />
              </Fragment>
            );
          })}
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom(true);
            setShowJump(false);
          }}
          className="fade-in absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-lg shadow-black/40 hover:bg-zinc-800"
        >
          <ArrowDown size={14} />
          New messages
        </button>
      )}
    </div>
  );
}

interface MessageRowProps {
  message: Message;
  own: boolean;
  isGroup: boolean;
  currentUserId: string;
  showSender: boolean;
  showAvatar: boolean;
  compactTop: boolean;
  highlighted: boolean;
  openMenu: "react" | "more" | null;
  setOpenMenu: (kind: "react" | "more" | null) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onJumpTo: (messageId: string) => void;
}

function MessageRow({
  message,
  own,
  isGroup,
  currentUserId,
  showSender,
  showAvatar,
  compactTop,
  highlighted,
  openMenu,
  setOpenMenu,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onJumpTo,
}: MessageRowProps) {
  const reactions = groupReactions(message, currentUserId);

  const readByOthers = message.readBy.some((id) => String(id) !== currentUserId);

  const images = message.attachments.filter((file) =>
    file.type.startsWith("image/"),
  );

  const files = message.attachments.filter(
    (file) => !file.type.startsWith("image/"),
  );

  const bubbleTone = message.deleted
    ? "border border-dashed border-zinc-800 bg-transparent text-zinc-500"
    : own
      ? "bg-zinc-100 text-zinc-900"
      : "bg-zinc-800/80 text-zinc-100";

  const corner = own
    ? compactTop
      ? "rounded-tr-md"
      : ""
    : compactTop
      ? "rounded-tl-md"
      : "";

  return (
    <div
      id={`message-${message._id}`}
      className={`group/message message-enter flex items-end gap-2 ${
        own ? "flex-row-reverse" : ""
      } ${compactTop ? "mt-0.5" : "mt-3"} ${
        reactions.length > 0 ? "mb-3" : ""
      }`}
    >
      {isGroup && !own && (
        <span className="w-8 shrink-0">
          {showAvatar && (
            <Avatar
              name={message.sender?.name}
              src={message.sender?.avatar}
              size="sm"
            />
          )}
        </span>
      )}

      <div
        className={`relative flex max-w-[85%] flex-col sm:max-w-[70%] ${
          own ? "items-end" : "items-start"
        }`}
      >
        {showSender && (
          <span className="mb-1 ml-3 text-xs font-medium text-zinc-400">
            {message.sender?.name}
          </span>
        )}

        <div
          className={`flex items-center gap-1 ${own ? "flex-row-reverse" : ""}`}
        >
          <div
            className={`relative rounded-2xl text-[15px] leading-snug transition-shadow ${bubbleTone} ${corner} ${
              highlighted ? "ring-2 ring-zinc-400" : ""
            } ${images.length > 0 && !message.content ? "p-1" : "px-3.5 py-2"}`}
          >
            {message.replyTo && !message.deleted && (
              <button
                type="button"
                onClick={() => onJumpTo(message.replyTo!._id)}
                className={`mb-1.5 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left ${
                  own
                    ? "border-zinc-500 bg-zinc-900/10"
                    : "border-zinc-400 bg-black/20"
                } ${images.length > 0 && !message.content ? "m-1 w-auto" : ""}`}
              >
                <span className="block text-xs font-medium opacity-80">
                  {getUserId(message.replyTo.sender) === currentUserId
                    ? "You"
                    : message.replyTo.sender?.name}
                </span>

                <span className="line-clamp-2 text-xs opacity-70">
                  {message.replyTo.deleted
                    ? "Message deleted"
                    : message.replyTo.content ||
                      message.replyTo.attachments?.[0]?.name ||
                      "Attachment"}
                </span>
              </button>
            )}

            {message.deleted ? (
              <span className="flex items-center gap-1.5 text-sm italic">
                <Trash2 size={13} aria-hidden />
                Message deleted
              </span>
            ) : (
              <>
                {images.length > 0 && (
                  <ImageGrid images={images} rounded={!message.content} />
                )}

                {files.map((file, index) => (
                  <FileCard key={`${file.url}-${index}`} file={file} own={own} />
                ))}

                {message.content && (
                  <p
                    className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                      images.length > 0 ? "px-2.5 pb-1 pt-1.5" : ""
                    }`}
                  >
                    {message.content}
                  </p>
                )}
              </>
            )}

            <span
              className={`flex items-center justify-end gap-1 text-[10px] ${
                own && !message.deleted ? "text-zinc-500" : "text-zinc-500"
              } ${images.length > 0 && !message.content ? "px-2 pb-1 pt-1" : "mt-0.5"}`}
            >
              {message.edited && !message.deleted && <span>edited ·</span>}

              <time dateTime={message.createdAt}>
                {formatTime(message.createdAt)}
              </time>

              {own && !message.deleted && (
                <span aria-label={readByOthers ? "Seen" : "Sent"}>
                  {readByOthers ? (
                    <CheckCheck size={13} className="text-sky-600" />
                  ) : (
                    <Check size={13} />
                  )}
                </span>
              )}
            </span>

            {reactions.length > 0 && (
              <div
                className={`absolute -bottom-3.5 flex gap-1 ${
                  own ? "right-2" : "left-2"
                }`}
              >
                {reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    onClick={() => onReact(message, reaction.emoji)}
                    className={`flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs shadow-sm transition ${
                      reaction.mine
                        ? "border-zinc-500 bg-zinc-700 text-zinc-100"
                        : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                    }`}
                    aria-label={`${reaction.emoji} ${reaction.count}${
                      reaction.mine ? ", including you" : ""
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    {reaction.count > 1 && (
                      <span className="text-[11px]">{reaction.count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!message.deleted && (
            <MessageActions
              own={own}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onReply={() => onReply(message)}
              onEdit={() => onEdit(message)}
              onDelete={() => onDelete(message)}
              onReact={(emoji) => onReact(message, emoji)}
              canEdit={own && Boolean(message.content)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageActions({
  own,
  openMenu,
  setOpenMenu,
  onReply,
  onEdit,
  onDelete,
  onReact,
  canEdit,
}: {
  own: boolean;
  openMenu: "react" | "more" | null;
  setOpenMenu: (kind: "react" | "more" | null) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  canEdit: boolean;
}) {
  const visible = openMenu
    ? "opacity-100"
    : "opacity-0 group-hover/message:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100";

  return (
    <div
      data-message-menu
      className={`relative flex shrink-0 items-center transition-opacity ${visible} ${
        own ? "flex-row-reverse" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpenMenu(openMenu === "react" ? null : "react")}
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="Add reaction"
        aria-expanded={openMenu === "react"}
      >
        <SmilePlus size={15} />
      </button>

      <button
        type="button"
        onClick={onReply}
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="Reply"
      >
        <Reply size={15} />
      </button>

      {own && (
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === "more" ? null : "more")}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="More actions"
          aria-expanded={openMenu === "more"}
        >
          <MoreHorizontal size={15} />
        </button>
      )}

      {openMenu === "react" && (
        <div
          role="menu"
          aria-label="Reactions"
          className={`fade-in absolute bottom-9 z-30 flex gap-0.5 rounded-full border border-zinc-800 bg-zinc-900 p-1 shadow-xl shadow-black/50 ${
            own ? "right-0" : "left-0"
          }`}
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              onClick={() => {
                onReact(emoji);
                setOpenMenu(null);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:scale-110 hover:bg-zinc-800"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {openMenu === "more" && (
        <div
          role="menu"
          className="fade-in absolute bottom-9 right-0 z-30 w-36 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-xl shadow-black/50"
        >
          {canEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpenMenu(null);
                onEdit();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpenMenu(null);
              onDelete();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ImageGrid({
  images,
  rounded,
}: {
  images: MessageAttachment[];
  rounded: boolean;
}) {
  const single = images.length === 1;

  return (
    <div
      className={`grid gap-1 overflow-hidden ${rounded ? "rounded-xl" : "mb-1 rounded-lg"} ${
        single ? "grid-cols-1" : "grid-cols-2"
      }`}
    >
      {images.map((image, index) => (
        <a
          key={`${image.url}-${index}`}
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block bg-zinc-900 ${
            !single && images.length === 3 && index === 0 ? "col-span-2" : ""
          }`}
        >
          <img
            src={image.url}
            alt={image.name}
            loading="lazy"
            className={`w-full object-cover ${
              single ? "max-h-80 min-w-48" : "aspect-square"
            }`}
          />
        </a>
      ))}
    </div>
  );
}

function FileCard({ file, own }: { file: MessageAttachment; own: boolean }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mb-1 flex min-w-52 items-center gap-3 rounded-xl px-2.5 py-2 transition ${
        own ? "bg-zinc-900/10 hover:bg-zinc-900/15" : "bg-black/20 hover:bg-black/30"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          own ? "bg-zinc-900/10" : "bg-zinc-700/60"
        }`}
      >
        <FileText size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className="block text-[11px] opacity-60">
          {formatFileSize(file.size)}
        </span>
      </span>
    </a>
  );
}
