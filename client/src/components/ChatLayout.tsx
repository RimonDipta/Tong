import { MessageSquarePlus, Upload, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";

import { useAuth } from "../context/AuthContext";
import api, { getErrorMessage } from "../lib/api";
import {
  formatLastSeen,
  getConversationTitle,
  getOtherParticipant,
  getUserId,
  mergeFiles,
  sortConversations,
} from "../lib/chat";
import { createSocket } from "../lib/socket";
import type { User } from "../types/auth";
import type { Conversation, Message, MessageAttachment } from "../types/chat";

import ChatHeader from "./chat/ChatHeader";
import Composer from "./chat/Composer";
import ConversationList from "./chat/ConversationList";
import InfoPanel from "./chat/InfoPanel";
import MessageList from "./chat/MessageList";
import NewConversationModal from "./NewConversationModal";
import NewGroupModal from "./NewGroupModal";
import { useConfirm } from "./ui/ConfirmDialog";
import { useToast } from "./ui/Toast";

interface SocketAck {
  success: boolean;
  error?: string;
  message?: Message;
}

const TYPING_IDLE_MS = 2000;

const TYPING_EXPIRE_MS = 5000;

export default function ChatLayout() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const { conversationId: selectedId = null } = useParams();

  const { user, logout } = useAuth();

  const currentUserId = getUserId(user);

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [loadingConversations, setLoadingConversations] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);

  const [loadingMessages, setLoadingMessages] = useState(false);

  const [hasMore, setHasMore] = useState(false);

  const [loadingOlder, setLoadingOlder] = useState(false);

  const [socket, setSocket] = useState<Socket | null>(null);

  const [connected, setConnected] = useState(true);

  const [presence, setPresence] = useState<Record<string, boolean>>({});

  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});

  const [typing, setTyping] = useState<Record<string, string[]>>({});

  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const [editing, setEditing] = useState<Message | null>(null);

  const [files, setFiles] = useState<File[]>([]);

  const [dragging, setDragging] = useState(false);

  const [showInfo, setShowInfo] = useState(false);

  const [showNewChat, setShowNewChat] = useState(false);

  const [showNewGroup, setShowNewGroup] = useState(false);

  /*
   * Socket handlers are registered once, so they
   * read the latest selection through a ref.
   */
  const selectedIdRef = useRef(selectedId);
  const conversationsRef = useRef(conversations);
  const typingTimers = useRef(new Map<string, number>());
  const typingState = useRef({ active: false, timer: 0, conversationId: "" });

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const selected = useMemo(
    () => conversations.find((item) => item._id === selectedId) || null,
    [conversations, selectedId],
  );

  const isOnline = useCallback(
    (person?: User) => {
      if (!person) {
        return false;
      }

      return presence[getUserId(person)] ?? Boolean(person.isOnline);
    },
    [presence],
  );

  const lastSeenFor = useCallback(
    (person?: User) =>
      person ? lastSeen[getUserId(person)] || person.lastSeen : undefined,
    [lastSeen],
  );

  /*
   * Typing names per conversation, for the
   * sidebar and header.
   */
  const typingNames = useMemo(() => {
    const result: Record<string, string[]> = {};

    for (const conversation of conversations) {
      const ids = typing[conversation._id];

      if (!ids?.length) {
        continue;
      }

      result[conversation._id] = ids.map(
        (id) =>
          conversation.participants
            .find((person) => getUserId(person) === id)
            ?.name.split(" ")[0] || "Someone",
      );
    }

    return result;
  }, [conversations, typing]);

  /*
  |--------------------------------------------------------------------------
  | Data loading
  |--------------------------------------------------------------------------
  */

  const loadConversations = useCallback(() => {
    return api
      .get("/conversations")
      .then((response) => {
        setConversations(sortConversations(response.data.conversations || []));
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, "Couldn't load your chats."));
      })
      .finally(() => {
        setLoadingConversations(false);
      });
  }, [toast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /*
   * The server echoes `conversation:read` back to
   * all of this user's sockets, which clears the
   * unread badge.
   */
  const markRead = useCallback(
    (conversationId: string) => {
      if (document.visibilityState === "visible") {
        socket?.emit("conversation:read", conversationId);
      }
    },
    [socket],
  );

  const loadMessages = useCallback(
    (conversationId: string) => {
      return api
        .get(`/conversations/${conversationId}/messages`)
        .then((response) => {
          if (selectedIdRef.current === conversationId) {
            setMessages(response.data.messages || []);
            setHasMore(Boolean(response.data.hasMore));
          }
        })
        .catch((error) => {
          if (selectedIdRef.current === conversationId) {
            setMessages([]);
            setHasMore(false);
            toast.error(getErrorMessage(error, "Couldn't load messages."));
          }
        })
        .finally(() => {
          if (selectedIdRef.current === conversationId) {
            setLoadingMessages(false);
          }
        });
    },
    [toast],
  );

  /*
   * Reset per-chat UI state while rendering when
   * the selected chat changes, then fetch.
   */
  const [shownId, setShownId] = useState<string | null>(null);

  if (shownId !== selectedId) {
    setShownId(selectedId);
    setReplyTo(null);
    setEditing(null);
    setFiles([]);
    setShowInfo(false);
    setMessages([]);
    setHasMore(false);
    setLoadingMessages(Boolean(selectedId));
  }

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);

  /*
   * Mark the open chat as read once its messages
   * are on screen, and again when the tab
   * regains focus.
   */
  useEffect(() => {
    if (!selectedId || loadingMessages) {
      return;
    }

    markRead(selectedId);

    function handleVisibility() {
      if (document.visibilityState === "visible" && selectedIdRef.current) {
        markRead(selectedIdRef.current);
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [selectedId, loadingMessages, markRead]);

  async function loadOlder() {
    if (!selectedId || !hasMore || loadingOlder || messages.length === 0) {
      return;
    }

    const conversationId = selectedId;

    try {
      setLoadingOlder(true);

      const response = await api.get(
        `/conversations/${conversationId}/messages`,
        { params: { before: messages[0]._id } },
      );

      if (selectedIdRef.current !== conversationId) {
        return;
      }

      const older: Message[] = response.data.messages || [];

      setMessages((current) => {
        const known = new Set(current.map((message) => message._id));

        return [...older.filter((message) => !known.has(message._id)), ...current];
      });

      setHasMore(Boolean(response.data.hasMore));
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't load earlier messages."));
    } finally {
      setLoadingOlder(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Unread count in the tab title
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const unread = conversations.reduce(
      (total, conversation) => total + (conversation.unreadCount || 0),
      0,
    );

    document.title = unread > 0 ? `(${unread}) Tong` : "Tong";

    return () => {
      document.title = "Tong";
    };
  }, [conversations]);

  /*
  |--------------------------------------------------------------------------
  | Socket
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const instance = createSocket();

    let hasConnectedBefore = false;

    const replaceMessage = (updated: Message) => {
      setMessages((current) =>
        current.map((message) =>
          message._id === updated._id ? updated : message,
        ),
      );

      setConversations((current) =>
        current.map((conversation) =>
          conversation.lastMessage?._id === updated._id
            ? { ...conversation, lastMessage: updated }
            : conversation,
        ),
      );
    };

    const clearTyping = (conversationId: string, userId: string) => {
      setTyping((current) => {
        const ids = current[conversationId];

        if (!ids?.includes(userId)) {
          return current;
        }

        return {
          ...current,
          [conversationId]: ids.filter((id) => id !== userId),
        };
      });
    };

    instance.on("connect", () => {
      setConnected(true);

      /*
       * After a reconnect, refetch what we may have
       * missed while offline.
       */
      if (hasConnectedBefore) {
        loadConversations();

        if (selectedIdRef.current) {
          loadMessages(selectedIdRef.current);
        }
      }

      hasConnectedBefore = true;
    });

    instance.on("disconnect", () => setConnected(false));

    instance.on("connect_error", () => setConnected(false));

    instance.on("presence:initial", (data: { userIds: string[] }) => {
      setPresence(Object.fromEntries(data.userIds.map((id) => [id, true])));
    });

    instance.on(
      "presence:update",
      (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
        setPresence((current) => ({ ...current, [data.userId]: data.isOnline }));

        if (data.lastSeen) {
          setLastSeen((current) => ({
            ...current,
            [data.userId]: data.lastSeen!,
          }));
        }
      },
    );

    instance.on("conversation:new", (conversation: Conversation) => {
      setConversations((current) =>
        current.some((item) => item._id === conversation._id)
          ? current
          : sortConversations([{ ...conversation, unreadCount: 0 }, ...current]),
      );
    });

    instance.on("conversation:updated", (conversation: Conversation) => {
      setConversations((current) =>
        current.map((item) =>
          item._id === conversation._id
            ? { ...conversation, unreadCount: item.unreadCount }
            : item,
        ),
      );
    });

    instance.on("conversation:removed", (data: { conversationId: string }) => {
      const removed = conversationsRef.current.find(
        (item) => item._id === data.conversationId,
      );

      setConversations((current) =>
        current.filter((item) => item._id !== data.conversationId),
      );

      if (selectedIdRef.current === data.conversationId) {
        navigate("/chat", { replace: true });

        if (removed?.name) {
          toast.show(`You're no longer in ${removed.name}`);
        }
      }
    });

    instance.on("conversation:read", (data: { conversationId: string }) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation._id === data.conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
    });

    instance.on("message:new", (message: Message) => {
      const conversationId = String(message.conversation);
      const fromMe = getUserId(message.sender) === currentUserId;
      const isOpen = selectedIdRef.current === conversationId;
      const visible = document.visibilityState === "visible";

      clearTyping(conversationId, getUserId(message.sender));

      if (isOpen) {
        setMessages((current) =>
          current.some((item) => item._id === message._id)
            ? current
            : [...current, message],
        );

        if (!fromMe && visible) {
          instance.emit("conversation:read", conversationId);
        }
      }

      if (!conversationsRef.current.some((item) => item._id === conversationId)) {
        loadConversations();
        return;
      }

      setConversations((current) =>
        sortConversations(
          current.map((conversation) =>
            conversation._id === conversationId
              ? {
                  ...conversation,
                  lastMessage: message,
                  updatedAt: message.createdAt,
                  unreadCount:
                    fromMe || (isOpen && visible)
                      ? conversation.unreadCount || 0
                      : (conversation.unreadCount || 0) + 1,
                }
              : conversation,
          ),
        ),
      );
    });

    instance.on("message:edited", replaceMessage);

    instance.on("message:deleted", replaceMessage);

    instance.on("message:reaction", (data: { message: Message }) =>
      replaceMessage(data.message),
    );

    instance.on(
      "message:read",
      (data: { conversationId: string; messageIds: string[]; userId: string }) => {
        if (data.conversationId !== selectedIdRef.current) {
          return;
        }

        const ids = new Set(data.messageIds);

        setMessages((current) =>
          current.map((message) =>
            ids.has(message._id) && !message.readBy.includes(data.userId)
              ? { ...message, readBy: [...message.readBy, data.userId] }
              : message,
          ),
        );
      },
    );

    instance.on(
      "typing:start",
      (data: { conversationId: string; userId: string }) => {
        if (data.userId === currentUserId) {
          return;
        }

        setTyping((current) => {
          const ids = current[data.conversationId] || [];

          return ids.includes(data.userId)
            ? current
            : { ...current, [data.conversationId]: [...ids, data.userId] };
        });

        /*
         * Expire in case the stop event is lost.
         */
        const key = `${data.conversationId}:${data.userId}`;

        window.clearTimeout(typingTimers.current.get(key));

        typingTimers.current.set(
          key,
          window.setTimeout(
            () => clearTyping(data.conversationId, data.userId),
            TYPING_EXPIRE_MS,
          ),
        );
      },
    );

    instance.on(
      "typing:stop",
      (data: { conversationId: string; userId: string }) =>
        clearTyping(data.conversationId, data.userId),
    );

    instance.connect();

    setSocket(instance);

    const timers = typingTimers.current;

    return () => {
      instance.removeAllListeners();
      instance.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      setSocket(null);
    };
  }, [currentUserId, loadConversations, loadMessages, navigate, toast]);

  /*
  |--------------------------------------------------------------------------
  | Typing (outgoing)
  |--------------------------------------------------------------------------
  */

  const stopTyping = useCallback(() => {
    const state = typingState.current;

    window.clearTimeout(state.timer);

    if (state.active && socket) {
      socket.emit("typing:stop", state.conversationId);
    }

    state.active = false;
  }, [socket]);

  const startTyping = useCallback(() => {
    if (!socket || !selectedId) {
      return;
    }

    const state = typingState.current;

    if (!state.active || state.conversationId !== selectedId) {
      if (state.active) {
        socket.emit("typing:stop", state.conversationId);
      }

      socket.emit("typing:start", selectedId);

      state.active = true;
      state.conversationId = selectedId;
    }

    window.clearTimeout(state.timer);

    state.timer = window.setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [socket, selectedId, stopTyping]);

  useEffect(() => stopTyping, [selectedId, stopTyping]);

  /*
  |--------------------------------------------------------------------------
  | Message actions
  |--------------------------------------------------------------------------
  */

  function emitWithAck(event: string, payload: unknown) {
    return new Promise<SocketAck>((resolve) => {
      if (!socket?.connected) {
        resolve({ success: false, error: "You're offline. Try again when reconnected." });
        return;
      }

      socket
        .timeout(15000)
        .emit(event, payload, (error: Error | null, response: SocketAck) => {
          if (error) {
            resolve({ success: false, error: "The server didn't respond. Try again." });
            return;
          }

          resolve(response);
        });
    });
  }

  async function sendMessage(content: string) {
    if (!selectedId) {
      return false;
    }

    const conversationId = selectedId;
    const attachmentsToUpload = files;
    const reply = replyTo;

    let attachments: MessageAttachment[] = [];

    if (attachmentsToUpload.length > 0) {
      try {
        const form = new FormData();

        attachmentsToUpload.forEach((file) => form.append("files", file));

        const response = await api.post("/uploads", form);

        attachments = response.data.files || [];
      } catch (error) {
        toast.error(getErrorMessage(error, "Couldn't upload your files."));
        return false;
      }
    }

    const result = await emitWithAck("message:send", {
      conversationId,
      content,
      replyTo: reply?._id,
      attachments,
    });

    if (!result.success) {
      toast.error(result.error || "Couldn't send your message.");
      return false;
    }

    if (selectedIdRef.current === conversationId) {
      setReplyTo(null);
      setFiles([]);
    }

    return true;
  }

  async function saveEdit(content: string) {
    if (!editing) {
      return false;
    }

    const result = await emitWithAck("message:edit", {
      messageId: editing._id,
      content,
    });

    if (!result.success) {
      toast.error(result.error || "Couldn't edit the message.");
      return false;
    }

    return true;
  }

  async function deleteMessage(message: Message) {
    const ok = await confirm({
      title: "Delete message?",
      description: "It will be removed for everyone in this chat. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });

    if (!ok) {
      return;
    }

    const result = await emitWithAck("message:delete", { messageId: message._id });

    if (!result.success) {
      toast.error(result.error || "Couldn't delete the message.");
      return;
    }

    if (editing?._id === message._id) {
      setEditing(null);
    }

    if (replyTo?._id === message._id) {
      setReplyTo(null);
    }
  }

  async function react(message: Message, emoji: string) {
    const result = await emitWithAck("message:reaction", {
      messageId: message._id,
      emoji,
    });

    if (!result.success) {
      toast.error(result.error || "Couldn't add the reaction.");
    }
  }

  function startEdit(message: Message) {
    setReplyTo(null);
    setFiles([]);
    setEditing(message);
  }

  function editLastOwnMessage() {
    const last = [...messages]
      .reverse()
      .find(
        (message) =>
          getUserId(message.sender) === currentUserId &&
          !message.deleted &&
          message.content,
      );

    if (last) {
      startEdit(last);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Conversations
  |--------------------------------------------------------------------------
  */

  function openConversation(conversationId: string) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation._id === conversationId && conversation.unreadCount
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );

    navigate(`/chat/${conversationId}`);
  }

  function upsertConversation(conversation: Conversation) {
    setConversations((current) => {
      const existing = current.find((item) => item._id === conversation._id);

      if (existing) {
        return current.map((item) =>
          item._id === conversation._id
            ? { ...conversation, unreadCount: existing.unreadCount }
            : item,
        );
      }

      return sortConversations([{ ...conversation, unreadCount: 0 }, ...current]);
    });
  }

  function handleCreated(conversation: Conversation) {
    upsertConversation(conversation);
    openConversation(conversation._id);
  }

  function handleLeft(conversationId: string) {
    setConversations((current) =>
      current.filter((item) => item._id !== conversationId),
    );

    navigate("/chat", { replace: true });
  }

  /*
  |--------------------------------------------------------------------------
  | Drag and drop files
  |--------------------------------------------------------------------------
  */

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);

    if (editing) {
      return;
    }

    const dropped = Array.from(event.dataTransfer.files);

    if (dropped.length === 0) {
      return;
    }

    const result = mergeFiles(files, dropped);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setFiles(result.files);
  }

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  const title = selected ? getConversationTitle(selected, currentUserId) : "";

  const other =
    selected && selected.type === "direct"
      ? getOtherParticipant(selected, currentUserId)
      : undefined;

  const otherOnline = isOnline(other);

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg)] text-zinc-100">
      <aside
        className={`${
          selectedId ? "hidden md:flex" : "flex"
        } w-full flex-col border-r border-zinc-800/70 bg-[var(--surface)] md:w-80 md:shrink-0 lg:w-96`}
      >
        {!connected && <ConnectionBanner />}

        <div className="min-h-0 flex-1">
          <ConversationList
            user={user}
            conversations={conversations}
            selectedId={selectedId}
            loading={loadingConversations}
            isOnline={isOnline}
            typingByConversation={typingNames}
            onSelect={openConversation}
            onNewChat={() => setShowNewChat(true)}
            onNewGroup={() => setShowNewGroup(true)}
            onLogout={logout}
          />
        </div>
      </aside>

      <main
        className={`${selectedId ? "flex" : "hidden md:flex"} relative min-w-0 flex-1 flex-col`}
        onDragOver={(event) => {
          if (selected && event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        {!connected && selected && (
          <div className="md:hidden">
            <ConnectionBanner />
          </div>
        )}

        {selected ? (
          <>
            <ChatHeader
              conversation={selected}
              title={title}
              avatar={selected.avatar || other?.avatar}
              online={otherOnline}
              statusText={otherOnline ? "Online" : formatLastSeen(lastSeenFor(other))}
              typingNames={typingNames[selected._id] || []}
              onBack={() => navigate("/chat")}
              onOpenInfo={() => setShowInfo(true)}
            />

            <MessageList
              conversation={selected}
              messages={messages}
              currentUserId={currentUserId}
              loading={loadingMessages}
              hasMore={hasMore}
              loadingOlder={loadingOlder}
              onLoadOlder={loadOlder}
              onReply={(message) => {
                setEditing(null);
                setReplyTo(message);
              }}
              onEdit={startEdit}
              onDelete={deleteMessage}
              onReact={react}
            />

            <Composer
              key={selected._id}
              conversationId={selected._id}
              currentUserId={currentUserId}
              replyTo={replyTo}
              editing={editing}
              files={files}
              onFilesChange={setFiles}
              onFileError={toast.error}
              onCancelReply={() => setReplyTo(null)}
              onCancelEdit={() => setEditing(null)}
              onSend={sendMessage}
              onSaveEdit={saveEdit}
              onEditLast={editLastOwnMessage}
              onTyping={startTyping}
              onStopTyping={stopTyping}
            />

            {dragging && (
              <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-500 bg-black/70 text-zinc-200">
                <Upload size={24} />
                <p className="text-sm font-medium">Drop files to attach</p>
                <p className="text-xs text-zinc-400">Up to 5 files, 10 MB each</p>
              </div>
            )}

            {showInfo && (
              <InfoPanel
                conversation={selected}
                currentUserId={currentUserId}
                title={title}
                isOnline={isOnline}
                lastSeenFor={lastSeenFor}
                onClose={() => setShowInfo(false)}
                onConversationChange={upsertConversation}
                onLeft={handleLeft}
              />
            )}
          </>
        ) : selectedId && !loadingConversations ? (
          <EmptyState
            title="Chat not found"
            body="It may have been deleted, or you're no longer a member."
            onAction={() => navigate("/chat")}
            actionLabel="Back to chats"
          />
        ) : (
          <EmptyState
            title={`Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
            body="Pick a chat from the list, or start a new one."
            onAction={() => setShowNewChat(true)}
            actionLabel="New message"
          />
        )}
      </main>

      <NewConversationModal
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onConversationCreated={handleCreated}
      />

      <NewGroupModal
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function ConnectionBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300"
    >
      <WifiOff size={13} />
      Reconnecting…
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-xl font-bold text-zinc-900">
          T
        </div>

        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>

        <p className="mt-1 text-sm text-zinc-500">{body}</p>

        <button type="button" onClick={onAction} className="btn-primary mt-5">
          <MessageSquarePlus size={16} />
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
