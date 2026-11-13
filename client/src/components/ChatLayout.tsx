import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Check,
  CheckCheck,
  Edit3,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  Upload,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";

import type { Socket } from "socket.io-client";

import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { createSocket } from "../lib/socket";

import type { Conversation, Message, MessageAttachment } from "../types/chat";

import type { User } from "../types/auth";

import NewConversationModal from "./NewConversationModal";
import NewGroupModal from "./NewGroupModal";

interface ChatLayoutProps {
  onLogout: () => Promise<void>;
}

interface SocketResponse {
  success: boolean;
  error?: string;
}

function getUserId(user?: User | null) {
  return user?._id || user?.id || "";
}

function getConversationTitle(
  conversation: Conversation,
  currentUserId: string,
) {
  if (conversation.type === "group") {
    return conversation.name || "Group conversation";
  }

  const participant = conversation.participants.find(
    (user) => getUserId(user) !== currentUserId,
  );

  return participant?.name || participant?.username || "Conversation";
}

function getConversationParticipant(
  conversation: Conversation,
  currentUserId: string,
) {
  return conversation.participants.find(
    (user) => getUserId(user) !== currentUserId,
  );
}

function getGroupMemberCount(conversation: Conversation) {
  return conversation.participants.length;
}

function getTypingNames(
  conversation: Conversation,
  typingUserIds: string[],
  currentUserId: string,
) {
  return typingUserIds
    .filter((userId) => userId !== currentUserId)
    .map(
      (userId) =>
        conversation.participants.find(
          (participant) => getUserId(participant) === userId,
        )?.name || "Someone",
    );
}

function getMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLastSeenText(lastSeen?: string) {
  if (!lastSeen) {
    return "Offline";
  }

  return `Last seen ${new Date(lastSeen).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function getReplyPreview(message: Message) {
  if (message.deleted) {
    return "This message was deleted";
  }

  if (message.content) {
    return message.content;
  }

  if (message.attachments?.length) {
    return message.attachments[0].name;
  }

  return "Message";
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatReactionCount(message: Message) {
  const counts = new Map<string, number>();

  for (const reaction of message.reactions || []) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
  }

  return Array.from(counts.entries());
}

const reactionOptions = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function SelectedImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!previewUrl) {
    return <div className="h-10 w-10 rounded bg-zinc-800" />;
  }

  return (
    <img src={previewUrl} alt="" className="h-10 w-10 rounded object-cover" />
  );
}

export default function ChatLayout({ onLogout }: ChatLayoutProps) {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  const currentUserId = getUserId(user);

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);

  const [messages, setMessages] = useState<Message[]>([]);

  const [messageInput, setMessageInput] = useState("");

  const [loadingConversations, setLoadingConversations] = useState(true);

  const [loadingMessages, setLoadingMessages] = useState(false);

  const [socket, setSocket] = useState<Socket | null>(null);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});

  const [lastSeenUsers, setLastSeenUsers] = useState<Record<string, string>>(
    {},
  );

  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const [reactionMenuMessageId, setReactionMenuMessageId] = useState<
    string | null
  >(null);

  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);

  const [showNewConversation, setShowNewConversation] = useState(false);

  const [showNewGroup, setShowNewGroup] = useState(false);

  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const [groupMembers, setGroupMembers] = useState<User[]>([]);

  const [groupAdmins, setGroupAdmins] = useState<string[]>([]);

  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);

  const [showAddMembers, setShowAddMembers] = useState(false);

  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const [memberSearchResults, setMemberSearchResults] = useState<User[]>([]);

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [searchingMembers, setSearchingMembers] = useState(false);

  const [addingMembers, setAddingMembers] = useState(false);

  const [addMembersError, setAddMembersError] = useState("");

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [uploadingFiles, setUploadingFiles] = useState(false);

  const typingTimeoutRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedConversation =
    conversations.find(
      (conversation) => conversation._id === selectedConversationId,
    ) || null;

  const selectedParticipant = selectedConversation
    ? getConversationParticipant(selectedConversation, currentUserId)
    : null;

  const isParticipantOnline = selectedParticipant
    ? (onlineUsers[getUserId(selectedParticipant)] ??
      selectedParticipant.isOnline ??
      false)
    : false;

  const selectedGroupMemberCount = selectedConversation
    ? getGroupMemberCount(selectedConversation)
    : 0;

  const isSelectedGroupAdmin =
    selectedConversation?.type === "group"
      ? (selectedConversation.admins || []).includes(currentUserId) ||
        groupAdmins.includes(currentUserId)
      : false;

  const selectedTypingNames = selectedConversation
    ? getTypingNames(selectedConversation, typingUsers, currentUserId)
    : [];

  const selectedTypingText =
    selectedTypingNames.length === 0
      ? ""
      : selectedTypingNames.length === 1
        ? `${selectedTypingNames[0]} is typing...`
        : selectedTypingNames.length === 2
          ? `${selectedTypingNames[0]} and ${selectedTypingNames[1]} are typing...`
          : `${selectedTypingNames[0]} and ${selectedTypingNames.length - 1} others are typing...`;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title = getConversationTitle(
        conversation,
        currentUserId,
      ).toLowerCase();

      const username =
        getConversationParticipant(
          conversation,
          currentUserId,
        )?.username?.toLowerCase() || "";

      return title.includes(query) || username.includes(query);
    });
  }, [conversations, currentUserId, searchQuery]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    });
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);

      const response = await api.get("/conversations");

      const loaded = response.data.conversations || [];

      setConversations(loaded);

      if (loaded.length > 0 && !selectedConversationId) {
        setSelectedConversationId(loaded[0]._id);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /*
  |--------------------------------------------------------------------------
  | Socket
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!accessToken || !currentUserId) {
      return;
    }

    const newSocket = createSocket(accessToken);

    setSocket(newSocket);

    newSocket.on("connect", () => {
      conversations.forEach((conversation) => {
        newSocket.emit("conversation:join", conversation._id);
      });
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    newSocket.on("presence:initial", (data: { userIds: string[] }) => {
      const presence: Record<string, boolean> = {};

      for (const userId of data.userIds) {
        presence[userId] = true;
      }

      setOnlineUsers(presence);
    });

    newSocket.on("conversation:new", (conversation: Conversation) => {
      setConversations((previous) => {
        const existing = previous.find((item) => item._id === conversation._id);

        if (existing) {
          return previous;
        }

        const updated = [conversation, ...previous];

        return updated.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });

      newSocket.emit("conversation:join", conversation._id);
    });

    newSocket.on(
      "conversation:members-updated",
      (data: { conversation: Conversation }) => {
        const updatedConversation = data.conversation;

        setConversations((previous) =>
          previous.map((conversation) =>
            conversation._id === updatedConversation._id
              ? updatedConversation
              : conversation,
          ),
        );

        if (updatedConversation._id === selectedConversationId) {
          setGroupMembers(updatedConversation.participants);
          setGroupAdmins(updatedConversation.admins || []);
        }
      },
    );

    newSocket.on("conversation:removed", (data: { conversationId: string }) => {
      setConversations((previous) =>
        previous.filter(
          (conversation) => conversation._id !== data.conversationId,
        ),
      );

      if (selectedConversationId === data.conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
        setShowGroupInfo(false);
      }
    });

    newSocket.on("conversation:deleted", (data: { conversationId: string }) => {
      setConversations((previous) =>
        previous.filter(
          (conversation) => conversation._id !== data.conversationId,
        ),
      );

      if (selectedConversationId === data.conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
        setShowGroupInfo(false);
      }
    });

    newSocket.on("message:new", (message: Message) => {
      setMessages((previous) => {
        if (previous.some((item) => item._id === message._id)) {
          return previous;
        }

        if (message.conversation !== selectedConversationId) {
          return previous;
        }

        return [...previous, message];
      });

      setConversations((previous) => {
        const updated = previous.map((conversation) => {
          if (conversation._id !== message.conversation) {
            return conversation;
          }

          return {
            ...conversation,
            lastMessage: message,
            updatedAt: message.createdAt,
          };
        });

        return updated.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });
    });

    newSocket.on("message:edited", (message: Message) => {
      setMessages((previous) =>
        previous.map((item) => (item._id === message._id ? message : item)),
      );
    });

    newSocket.on("message:deleted", (message: Message) => {
      setMessages((previous) =>
        previous.map((item) => (item._id === message._id ? message : item)),
      );

      setConversations((previous) =>
        previous.map((conversation) => {
          if (conversation.lastMessage?._id !== message._id) {
            return conversation;
          }

          return {
            ...conversation,
            lastMessage: message,
          };
        }),
      );
    });

    newSocket.on(
      "message:read",
      (data: {
        conversationId: string;
        messageIds: string[];
        userId: string;
      }) => {
        if (data.conversationId !== selectedConversationId) {
          return;
        }

        setMessages((previous) =>
          previous.map((message) => {
            if (!data.messageIds.includes(message._id)) {
              return message;
            }

            if (message.readBy.includes(data.userId)) {
              return message;
            }

            return {
              ...message,
              readBy: [...message.readBy, data.userId],
            };
          }),
        );
      },
    );

    newSocket.on("message:reaction", (data: { message: Message }) => {
      setMessages((previous) =>
        previous.map((item) =>
          item._id === data.message._id ? data.message : item,
        ),
      );
    });

    newSocket.on(
      "typing:start",
      (data: { conversationId: string; userId: string }) => {
        if (
          data.conversationId !== selectedConversationId ||
          data.userId === currentUserId
        ) {
          return;
        }

        setTypingUsers((previous) =>
          previous.includes(data.userId)
            ? previous
            : [...previous, data.userId],
        );
      },
    );

    newSocket.on(
      "typing:stop",
      (data: { conversationId: string; userId: string }) => {
        if (data.conversationId !== selectedConversationId) {
          return;
        }

        setTypingUsers((previous) =>
          previous.filter((id) => id !== data.userId),
        );
      },
    );

    newSocket.on(
      "presence:update",
      (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
        setOnlineUsers((previous) => ({
          ...previous,
          [data.userId]: data.isOnline,
        }));

        if (data.lastSeen) {
          setLastSeenUsers((previous) => ({
            ...previous,
            [data.userId]: data.lastSeen!,
          }));
        }
      },
    );

    newSocket.connect();

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
    };
  }, [accessToken, currentUserId, conversations, selectedConversationId]);

  /*
  |--------------------------------------------------------------------------
  | Messages
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        setLoadingMessages(true);

        const response = await api.get(
          `/conversations/${selectedConversationId}/messages`,
        );

        setMessages(response.data.messages || []);

        socket?.emit("conversation:join", selectedConversationId);

        socket?.emit("conversation:read", selectedConversationId);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();

    setReplyTo(null);
    setEditingMessage(null);
    setSelectedFiles([]);
    setReactionMenuMessageId(null);
    setMessageMenuId(null);
  }, [selectedConversationId, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /*
  |--------------------------------------------------------------------------
  | File selection
  |--------------------------------------------------------------------------
  */

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const combined = [...selectedFiles, ...files];

    if (combined.length > 5) {
      window.alert("You can attach a maximum of 5 files.");

      event.target.value = "";

      return;
    }

    const oversized = combined.find((file) => file.size > 10 * 1024 * 1024);

    if (oversized) {
      window.alert(`${oversized.name} is larger than 10 MB.`);

      event.target.value = "";

      return;
    }

    setSelectedFiles(combined);

    event.target.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Upload files
  |--------------------------------------------------------------------------
  */

  async function uploadSelectedFiles() {
    if (selectedFiles.length === 0) {
      return [];
    }

    const formData = new FormData();

    for (const file of selectedFiles) {
      formData.append("files", file);
    }

    const response = await api.post("/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return (response.data.files || []) as MessageAttachment[];
  }

  /*
  |--------------------------------------------------------------------------
  | Typing
  |--------------------------------------------------------------------------
  */

  function handleTyping() {
    if (!socket || !selectedConversationId) {
      return;
    }

    socket.emit("typing:start", selectedConversationId);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("typing:stop", selectedConversationId);
    }, 1000);
  }

  /*
  |--------------------------------------------------------------------------
  | Send message
  |--------------------------------------------------------------------------
  */

  async function handleSend() {
    const content = messageInput.trim();

    if (
      (!content && selectedFiles.length === 0) ||
      !socket ||
      !selectedConversationId
    ) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Editing does not allow attachments
    |--------------------------------------------------------------------------
    */

    if (editingMessage) {
      socket.timeout(10000).emit(
        "message:edit",
        {
          messageId: editingMessage._id,

          content,
        },
        (error: Error | undefined, response: SocketResponse) => {
          if (error) {
            console.error("Edit timeout:", error);

            return;
          }

          if (!response.success) {
            window.alert(response.error || "Failed to edit message");

            return;
          }

          setMessageInput("");
          setEditingMessage(null);

          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        },
      );

      return;
    }

    try {
      setUploadingFiles(selectedFiles.length > 0);

      let attachments: MessageAttachment[] | undefined;

      if (selectedFiles.length > 0) {
        attachments = await uploadSelectedFiles();
      }

      socket.timeout(10000).emit(
        "message:send",
        {
          conversationId: selectedConversationId,

          content,

          replyTo: replyTo?._id,

          attachments: attachments || [],
        },
        (error: Error | undefined, response: SocketResponse) => {
          if (error) {
            console.error("Send message timeout:", error);

            window.alert("Failed to send message.");

            return;
          }

          if (!response.success) {
            window.alert(response.error || "Failed to send message.");

            return;
          }

          setMessageInput("");
          setReplyTo(null);
          setSelectedFiles([]);

          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        },
      );
    } catch (error) {
      console.error("Upload failed:", error);

      window.alert(
        error instanceof Error ? error.message : "Failed to upload files.",
      );
    } finally {
      setUploadingFiles(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Keyboard
  |--------------------------------------------------------------------------
  */

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }

    if (event.key === "Escape") {
      setReplyTo(null);
      setEditingMessage(null);
      setMessageInput("");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Reply
  |--------------------------------------------------------------------------
  */

  function handleReply(message: Message) {
    if (message.deleted) {
      return;
    }

    setReplyTo(message);
    setEditingMessage(null);
    setReactionMenuMessageId(null);
    setMessageMenuId(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Edit
  |--------------------------------------------------------------------------
  */

  function handleEdit(message: Message) {
    if (message.deleted || getUserId(message.sender) !== currentUserId) {
      return;
    }

    setEditingMessage(message);

    setReplyTo(null);
    setSelectedFiles([]);
    setReactionMenuMessageId(null);
    setMessageMenuId(null);
    setMessageInput(message.content);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Delete
  |--------------------------------------------------------------------------
  */

  function handleDelete(message: Message) {
    if (!socket || getUserId(message.sender) !== currentUserId) {
      return;
    }

    if (!window.confirm("Delete this message?")) {
      return;
    }

    socket.timeout(10000).emit(
      "message:delete",
      {
        messageId: message._id,
      },
      (error: Error | undefined, response: SocketResponse) => {
        if (error) {
          console.error("Delete timeout:", error);

          return;
        }

        if (!response.success) {
          window.alert(response.error || "Failed to delete message.");

          return;
        }

        setMessageMenuId(null);
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Reaction
  |--------------------------------------------------------------------------
  */

  function handleReaction(message: Message, emoji: string) {
    if (!socket || message.deleted) {
      return;
    }

    socket.timeout(10000).emit(
      "message:reaction",
      {
        messageId: message._id,

        emoji,
      },
      (error: Error | undefined, response: SocketResponse) => {
        if (error) {
          console.error("Reaction timeout:", error);

          return;
        }

        if (!response.success) {
          console.error(response.error);
        }
      },
    );

    setReactionMenuMessageId(null);
  }

  /*
  |--------------------------------------------------------------------------
  | Conversation
  |--------------------------------------------------------------------------
  */

  function selectConversation(conversationId: string) {
    if (selectedConversationId && socket) {
      socket.emit("conversation:leave", selectedConversationId);
    }

    setSelectedConversationId(conversationId);
    setShowGroupInfo(false);

    setMobileSidebarOpen(false);
  }

  async function openGroupInfo() {
    if (!selectedConversation || selectedConversation.type !== "group") {
      return;
    }

    setShowGroupInfo(true);
    setGroupMembers(selectedConversation.participants);
    setGroupAdmins(selectedConversation.admins || []);

    try {
      setLoadingGroupMembers(true);

      const response = await api.get(
        `/conversations/${selectedConversation._id}/members`,
      );

      setGroupMembers(response.data.members || []);
      setGroupAdmins(response.data.admins || []);
    } catch (error) {
      console.error("Failed to load group members:", error);
    } finally {
      setLoadingGroupMembers(false);
    }
  }

  function closeAddMembers() {
    setShowAddMembers(false);
    setMemberSearchQuery("");
    setMemberSearchResults([]);
    setSelectedMemberIds([]);
    setAddMembersError("");
  }

  function toggleSelectedMember(userId: string) {
    setSelectedMemberIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  }

  useEffect(() => {
    if (
      !showAddMembers ||
      !selectedConversation ||
      selectedConversation.type !== "group"
    ) {
      return;
    }

    const query = memberSearchQuery.trim();

    if (query.length < 2) {
      setMemberSearchResults([]);
      setSearchingMembers(false);
      return;
    }

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      try {
        setSearchingMembers(true);
        setAddMembersError("");

        const response = await api.get("/users/search", {
          params: { q: query },
        });

        if (cancelled) {
          return;
        }

        const existingMemberIds = new Set(
          selectedConversation.participants.map((member) => getUserId(member)),
        );

        const results = (response.data.users || []).filter(
          (result: User) => !existingMemberIds.has(getUserId(result)),
        );

        setMemberSearchResults(results);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to search members:", error);
          setMemberSearchResults([]);
          setAddMembersError("Failed to search users.");
        }
      } finally {
        if (!cancelled) {
          setSearchingMembers(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [memberSearchQuery, selectedConversation, showAddMembers]);

  async function handleAddMembers() {
    if (
      !selectedConversation ||
      selectedConversation.type !== "group" ||
      selectedMemberIds.length === 0 ||
      addingMembers
    ) {
      return;
    }

    try {
      setAddingMembers(true);
      setAddMembersError("");

      const response = await api.post(
        `/conversations/${selectedConversation._id}/members`,
        {
          userIds: selectedMemberIds,
        },
      );

      const updatedConversation = response.data.conversation as
        | Conversation
        | undefined;

      if (updatedConversation) {
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation._id === updatedConversation._id
              ? updatedConversation
              : conversation,
          ),
        );

        setGroupMembers(updatedConversation.participants || groupMembers);
        setGroupAdmins(updatedConversation.admins || groupAdmins);
      } else {
        await openGroupInfo();
      }

      closeAddMembers();
    } catch (error: any) {
      console.error("Failed to add group members:", error);

      setAddMembersError(
        error?.response?.data?.message || "Failed to add members.",
      );
    } finally {
      setAddingMembers(false);
    }
  }

  function closeGroupInfo() {
    closeAddMembers();
    setShowGroupInfo(false);
  }

  function handleNewGroup(conversation: Conversation) {
    setConversations((previous) => {
      const exists = previous.some((item) => item._id === conversation._id);

      if (exists) {
        return previous.map((item) =>
          item._id === conversation._id ? conversation : item,
        );
      }

      return [conversation, ...previous];
    });

    setSelectedConversationId(conversation._id);
    setShowGroupInfo(false);
    setMobileSidebarOpen(false);
  }

  function handleNewConversation(conversation: Conversation) {
    setConversations((previous) => {
      const exists = previous.some((item) => item._id === conversation._id);

      if (exists) {
        return previous;
      }

      return [conversation, ...previous];
    });

    setSelectedConversationId(conversation._id);
    setShowGroupInfo(false);

    setMobileSidebarOpen(false);
  }

  function cancelEditing() {
    setEditingMessage(null);
    setMessageInput("");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Sidebar */}

      <aside
        className={`${
          mobileSidebarOpen ? "flex" : "hidden"
        } w-full flex-col border-r border-zinc-800/80 bg-[#0b0b0e] md:flex md:w-[320px] md:shrink-0`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-800/80 px-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Tong</h1>

            <p className="text-[11px] text-zinc-600">Messages</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowNewGroup(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
              aria-label="Create group"
            >
              <Users size={17} />
            </button>

            <button
              type="button"
              onClick={() => setShowNewConversation(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
              aria-label="New conversation"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="border-b border-zinc-800/80 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3">
            <Search size={15} className="text-zinc-600" />

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex justify-center px-4 py-12 text-sm text-zinc-600">
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <MessageCircle size={20} className="mb-3 text-zinc-700" />

              <p className="text-sm text-zinc-400">No conversations</p>

              <button
                type="button"
                onClick={() => setShowNewConversation(true)}
                className="mt-3 text-xs text-zinc-600 hover:text-zinc-300"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isGroup = conversation.type === "group";

              const participant = isGroup
                ? null
                : getConversationParticipant(conversation, currentUserId);

              const participantId = getUserId(participant);

              const isSelected = conversation._id === selectedConversationId;

              const isOnline =
                !isGroup && participant
                  ? (onlineUsers[participantId] ??
                    participant.isOnline ??
                    false)
                  : false;

              return (
                <button
                  key={conversation._id}
                  type="button"
                  onClick={() => selectConversation(conversation._id)}
                  className={`flex w-full items-center gap-3 border-b border-zinc-900 px-4 py-3 text-left ${
                    isSelected ? "bg-zinc-900/80" : "hover:bg-zinc-900/50"
                  }`}
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm font-medium text-zinc-300">
                    {conversation.avatar ? (
                      <img
                        src={conversation.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : isGroup ? (
                      <Users size={17} className="text-zinc-400" />
                    ) : participant?.avatar ? (
                      <img
                        src={participant.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (participant?.name || "?").slice(0, 1).toUpperCase()
                    )}

                    {isOnline && (
                      <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0e] bg-emerald-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {getConversationTitle(conversation, currentUserId)}
                      </p>

                      {conversation.lastMessage && (
                        <span className="shrink-0 text-[10px] text-zinc-600">
                          {getMessageTime(conversation.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {isGroup
                        ? `${getGroupMemberCount(conversation)} ${
                            getGroupMemberCount(conversation) === 1
                              ? "member"
                              : "members"
                          }${
                            conversation.lastMessage
                              ? ` · ${
                                  conversation.lastMessage.deleted
                                    ? "Message deleted"
                                    : conversation.lastMessage.content ||
                                      (conversation.lastMessage.attachments
                                        ?.length
                                        ? "Attachment"
                                        : "No messages yet")
                                }`
                              : ""
                          }`
                        : conversation.lastMessage?.deleted
                          ? "This message was deleted"
                          : conversation.lastMessage?.content
                            ? conversation.lastMessage.content
                            : conversation.lastMessage?.attachments?.length
                              ? "Attachment"
                              : "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-zinc-800/80 p-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-zinc-900"
              aria-label="Open profile"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-400">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || "Profile"}
                    className="h-full w-full object-cover"
                  />
                ) : user?.name ? (
                  user.name.slice(0, 1).toUpperCase()
                ) : (
                  <UserRound size={17} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-300">
                  {user?.name || "Your profile"}
                </p>

                <p className="truncate text-[11px] text-zinc-600">
                  @{user?.username || "username"}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-900 hover:text-zinc-300"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}

      <main
        className={`${
          mobileSidebarOpen ? "hidden" : "flex"
        } min-w-0 flex-1 flex-col md:flex`}
      >
        {selectedConversation ? (
          <>
            {/* Header */}

            <header className="flex h-16 shrink-0 items-center border-b border-zinc-800/80 bg-[#0b0b0e] px-4">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 md:hidden"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs">
                  {selectedConversation.avatar ? (
                    <img
                      src={selectedConversation.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : selectedConversation.type === "group" ? (
                    <Users size={16} className="text-zinc-400" />
                  ) : selectedParticipant?.avatar ? (
                    <img
                      src={selectedParticipant.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (
                      selectedParticipant?.name ||
                      selectedConversation.name ||
                      "?"
                    )
                      .slice(0, 1)
                      .toUpperCase()
                  )}

                  {selectedConversation.type !== "group" &&
                    isParticipantOnline && (
                      <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0e] bg-emerald-500" />
                    )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium text-zinc-200">
                    {getConversationTitle(selectedConversation, currentUserId)}
                  </h2>

                  <p className="mt-0.5 truncate text-[11px] text-zinc-600">
                    {typingUsers.length > 0
                      ? selectedTypingText
                      : selectedConversation.type === "group"
                        ? `${selectedGroupMemberCount} ${
                            selectedGroupMemberCount === 1
                              ? "member"
                              : "members"
                          }`
                        : isParticipantOnline
                          ? "Online"
                          : getLastSeenText(
                              lastSeenUsers[getUserId(selectedParticipant)] ||
                                selectedParticipant?.lastSeen,
                            )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900"
                >
                  <Phone size={17} />
                </button>

                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900"
                >
                  <Video size={18} />
                </button>

                <button
                  type="button"
                  onClick={
                    selectedConversation.type === "group"
                      ? openGroupInfo
                      : undefined
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 disabled:cursor-default disabled:hover:bg-transparent"
                  aria-label={
                    selectedConversation.type === "group"
                      ? "Group information"
                      : "Conversation options"
                  }
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </header>

            {/* Messages */}

            <section className="min-h-0 flex-1 overflow-y-auto bg-[#09090b] px-4 py-5">
              <div className="mx-auto flex max-w-4xl flex-col gap-2">
                {loadingMessages ? (
                  <div className="py-16 text-center text-sm text-zinc-600">
                    Loading messages...
                  </div>
                ) : (
                  messages.map((message) => {
                    const own = getUserId(message.sender) === currentUserId;

                    const reactions = formatReactionCount(message);

                    const isRead =
                      own && message.readBy.some((id) => id !== currentUserId);

                    return (
                      <div
                        key={message._id}
                        className={`group flex ${
                          own ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div className="relative max-w-[78%] sm:max-w-[68%]">
                          <div
                            className={`flex items-end gap-1.5 ${
                              own ? "flex-row-reverse" : ""
                            }`}
                          >
                            <div
                              className={`relative rounded-2xl px-3.5 py-2.5 text-sm ${
                                message.deleted
                                  ? "bg-zinc-900 text-zinc-600 italic"
                                  : own
                                    ? "rounded-br-md bg-zinc-100 text-zinc-900"
                                    : "rounded-bl-md border border-zinc-800 bg-zinc-900 text-zinc-200"
                              }`}
                            >
                              {message.replyTo && !message.deleted && (
                                <div className="mb-2 rounded-lg border-l-2 border-zinc-500 bg-zinc-800/50 px-2.5 py-1.5">
                                  <p className="text-[10px] font-medium text-zinc-400">
                                    {getUserId(message.replyTo.sender) ===
                                    currentUserId
                                      ? "You"
                                      : message.replyTo.sender.name}
                                  </p>

                                  <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                                    {getReplyPreview(message.replyTo)}
                                  </p>
                                </div>
                              )}

                              {message.deleted ? (
                                <div className="flex items-center gap-2">
                                  <Trash2 size={13} />
                                  This message was deleted
                                </div>
                              ) : (
                                <>
                                  {message.content && (
                                    <p className="whitespace-pre-wrap break-words">
                                      {message.content}
                                    </p>
                                  )}

                                  {message.attachments?.map(
                                    (attachment, index) => {
                                      const isImage =
                                        attachment.type.startsWith("image/");

                                      return (
                                        <div
                                          key={`${message._id}-${index}`}
                                          className={`mt-2 overflow-hidden rounded-lg border ${
                                            own
                                              ? "border-zinc-300/60"
                                              : "border-zinc-700"
                                          }`}
                                        >
                                          {isImage ? (
                                            <a
                                              href={attachment.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="block"
                                            >
                                              <img
                                                src={attachment.url}
                                                alt={attachment.name}
                                                className="max-h-80 w-full object-cover"
                                              />
                                            </a>
                                          ) : (
                                            <a
                                              href={attachment.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              download={
                                                attachment.type ===
                                                "application/pdf"
                                                  ? undefined
                                                  : attachment.name
                                              }
                                              className="flex items-center gap-3 px-3 py-3 transition hover:bg-black/10"
                                            >
                                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/10">
                                                <FileText size={17} />
                                              </div>

                                              <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-medium">
                                                  {attachment.name}
                                                </p>

                                                <p className="mt-0.5 text-[10px] opacity-60">
                                                  {attachment.type ===
                                                  "application/pdf"
                                                    ? "PDF · Click to open"
                                                    : formatFileSize(
                                                        attachment.size,
                                                      )}
                                                </p>
                                              </div>
                                            </a>
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                                </>
                              )}

                              <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-50">
                                {message.edited && !message.deleted && (
                                  <span>edited</span>
                                )}

                                <span>{getMessageTime(message.createdAt)}</span>

                                {own &&
                                  !message.deleted &&
                                  (isRead ? (
                                    <CheckCheck size={13} />
                                  ) : (
                                    <Check size={13} />
                                  ))}
                              </div>

                              {!message.deleted && reactions.length > 0 && (
                                <div className="absolute -bottom-3 left-1 flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-1.5 py-0.5">
                                  {reactions.map(([emoji, count]) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() =>
                                        handleReaction(message, emoji)
                                      }
                                      className="text-[10px]"
                                    >
                                      {emoji}{" "}
                                      <span className="text-zinc-500">
                                        {count}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {!message.deleted && (
                              <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => handleReply(message)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"
                                >
                                  <Reply size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReactionMenuMessageId((previous) =>
                                      previous === message._id
                                        ? null
                                        : message._id,
                                    )
                                  }
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"
                                >
                                  <Smile size={14} />
                                </button>
                                \n{" "}
                                {reactionMenuMessageId === message._id && (
                                  <div
                                    className={`absolute bottom-8 z-40 flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl ${
                                      own ? "right-0" : "left-0"
                                    }`}
                                  >
                                    {reactionOptions.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() =>
                                          handleReaction(message, emoji)
                                        }
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-zinc-800"
                                        aria-label={`React with ${emoji}`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {own && (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMessageMenuId((previous) =>
                                          previous === message._id
                                            ? null
                                            : message._id,
                                        )
                                      }
                                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"
                                    >
                                      <MoreHorizontal size={14} />
                                    </button>

                                    {messageMenuId === message._id && (
                                      <div className="absolute bottom-8 right-0 z-30 w-32 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-2xl">
                                        <button
                                          type="button"
                                          onClick={() => handleEdit(message)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-900"
                                        >
                                          <Edit3 size={13} />
                                          Edit
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDelete(message)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-500 hover:bg-zinc-900"
                                        >
                                          <Trash2 size={13} />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                <div ref={messagesEndRef} />
              </div>
            </section>

            {/* Composer */}

            <div className="border-t border-zinc-800/80 bg-[#0b0b0e]">
              {typingUsers.length > 0 && (
                <div className="px-4 pt-2 text-[11px] text-zinc-600">
                  {selectedTypingText}
                </div>
              )}

              {/* Reply */}

              {replyTo && (
                <div className="px-3 pt-3">
                  <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                    <div className="h-8 w-0.5 bg-zinc-500" />

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-zinc-400">
                        Replying to{" "}
                        {getUserId(replyTo.sender) === currentUserId
                          ? "yourself"
                          : replyTo.sender.name}
                      </p>

                      <p className="truncate text-xs text-zinc-600">
                        {getReplyPreview(replyTo)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="flex h-7 w-7 items-center justify-center text-zinc-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Editing */}

              {editingMessage && (
                <div className="px-3 pt-3">
                  <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                    <Edit3 size={14} className="text-zinc-500" />

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-zinc-400">
                        Editing message
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="text-zinc-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Selected files */}

              {selectedFiles.length > 0 && (
                <div className="px-3 pt-3">
                  <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto">
                    {selectedFiles.map((file, index) => {
                      const isImage = file.type.startsWith("image/");

                      return (
                        <div
                          key={`${file.name}-${index}`}
                          className="relative flex w-40 shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2"
                        >
                          {isImage ? (
                            <SelectedImagePreview file={file} />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-zinc-500">
                              <FileText size={16} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] text-zinc-300">
                              {file.name}
                            </p>

                            <p className="text-[9px] text-zinc-600">
                              {formatFileSize(file.size)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeSelectedFile(index)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-500 hover:text-white"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="px-3 py-3">
                <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-2 py-2">
                  {/* Hidden file input */}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles || !!editingMessage}
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Attach files"
                  >
                    <Paperclip size={17} />
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(event) => {
                      setMessageInput(event.target.value);

                      event.target.style.height = "auto";

                      event.target.style.height = `${Math.min(
                        event.target.scrollHeight,
                        120,
                      )}px`;

                      if (!editingMessage) {
                        handleTyping();
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      editingMessage ? "Edit message..." : "Write a message..."
                    }
                    rows={1}
                    className="max-h-[120px] min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-zinc-200 outline-none placeholder:text-zinc-600"
                  />

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={
                      uploadingFiles ||
                      (!messageInput.trim() && selectedFiles.length === 0)
                    }
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                    aria-label="Send"
                  >
                    {uploadingFiles ? (
                      <Upload size={16} className="animate-pulse" />
                    ) : editingMessage ? (
                      <Check size={17} />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>

                <p className="mx-auto mt-1.5 max-w-4xl px-1 text-[9px] text-zinc-700">
                  Enter to send · Shift + Enter for a new line · Max 10 MB per
                  file
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#09090b]">
            <div className="text-center">
              <MessageCircle size={20} className="mx-auto mb-4 text-zinc-700" />

              <h2 className="text-sm font-medium text-zinc-400">
                Welcome to Tong
              </h2>

              <p className="mt-1 text-xs text-zinc-700">
                Select a conversation to start chatting.
              </p>
            </div>
          </div>
        )}
      </main>

      {showGroupInfo && selectedConversation?.type === "group" && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
          <button
            type="button"
            aria-label="Close group information"
            onClick={closeGroupInfo}
            className="absolute inset-0 cursor-default"
          />

          <aside className="relative flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-[#0b0b0e] shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800/80 px-4">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">
                  {showAddMembers ? "Add members" : "Group information"}
                </h2>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {showAddMembers
                    ? `${selectedMemberIds.length} selected`
                    : `${groupMembers.length} ${groupMembers.length === 1 ? "member" : "members"}`}
                </p>
              </div>

              <button
                type="button"
                onClick={showAddMembers ? closeAddMembers : closeGroupInfo}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
                aria-label={
                  showAddMembers
                    ? "Close add members"
                    : "Close group information"
                }
              >
                <X size={17} />
              </button>
            </div>

            {showAddMembers ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-zinc-800/80 p-4">
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3">
                    <Search size={15} className="text-zinc-600" />
                    <input
                      autoFocus
                      value={memberSearchQuery}
                      onChange={(event) =>
                        setMemberSearchQuery(event.target.value)
                      }
                      placeholder="Search people"
                      className="h-10 min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                    />
                  </div>

                  {addMembersError && (
                    <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                      {addMembersError}
                    </p>
                  )}
                </div>

                {selectedMemberIds.length > 0 && (
                  <div className="border-b border-zinc-800/80 px-4 py-3">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Selected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedMemberIds.map((id) => {
                        const member = memberSearchResults.find(
                          (result) => getUserId(result) === id,
                        );

                        if (!member) {
                          return null;
                        }

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleSelectedMember(id)}
                            className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700"
                          >
                            <span className="max-w-28 truncate">
                              {member.name || member.username}
                            </span>
                            <X size={11} className="text-zinc-600" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {memberSearchQuery.trim().length < 2 ? (
                    <div className="px-6 py-12 text-center">
                      <Search
                        size={20}
                        className="mx-auto mb-3 text-zinc-700"
                      />
                      <p className="text-xs text-zinc-600">
                        Search for people to add to this group.
                      </p>
                    </div>
                  ) : searchingMembers ? (
                    <div className="px-6 py-12 text-center text-xs text-zinc-600">
                      Searching...
                    </div>
                  ) : memberSearchResults.length === 0 ? (
                    <div className="px-6 py-12 text-center text-xs text-zinc-600">
                      No available users found.
                    </div>
                  ) : (
                    memberSearchResults.map((member) => {
                      const memberId = getUserId(member);
                      const selected = selectedMemberIds.includes(memberId);

                      return (
                        <button
                          key={memberId}
                          type="button"
                          onClick={() => toggleSelectedMember(memberId)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                            selected ? "bg-zinc-900" : "hover:bg-zinc-900/60"
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm font-medium text-zinc-300">
                            {member.avatar ? (
                              <img
                                src={member.avatar}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (member.name || member.username || "?")
                                .slice(0, 1)
                                .toUpperCase()
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-300">
                              {member.name || member.username}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-zinc-600">
                              @{member.username}
                            </p>
                          </div>

                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                                : "border-zinc-700 text-transparent"
                            }`}
                          >
                            <Check size={12} />
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex gap-2 border-t border-zinc-800/80 p-4">
                  <button
                    type="button"
                    onClick={closeAddMembers}
                    className="flex-1 rounded-lg border border-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMembers}
                    disabled={addingMembers || selectedMemberIds.length === 0}
                    className="flex-1 rounded-lg bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                  >
                    {addingMembers
                      ? "Adding..."
                      : `Add ${selectedMemberIds.length || ""} ${selectedMemberIds.length === 1 ? "member" : "members"}`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-zinc-800/80 px-5 py-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-400">
                    {selectedConversation.avatar ? (
                      <img
                        src={selectedConversation.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Users size={24} />
                    )}
                  </div>

                  <h3 className="mt-3 truncate text-base font-medium text-zinc-200">
                    {selectedConversation.name || "Group conversation"}
                  </h3>

                  <p className="mt-1 text-xs text-zinc-600">
                    {groupMembers.length}{" "}
                    {groupMembers.length === 1 ? "member" : "members"}
                  </p>
                </div>

                <div className="border-b border-zinc-800/80 p-4">
                  {isSelectedGroupAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAddMembersError("");
                        setShowAddMembers(true);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                        <Plus size={17} />
                      </span>
                      <span>
                        <span className="block text-xs font-medium text-zinc-300">
                          Add members
                        </span>
                        <span className="mt-0.5 block text-[10px] text-zinc-600">
                          Invite more people to this group
                        </span>
                      </span>
                    </button>
                  ) : (
                    <p className="px-1 text-[11px] text-zinc-600">
                      Only group admins can add members.
                    </p>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="px-4 py-3">
                    <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Members
                    </p>
                  </div>

                  {loadingGroupMembers ? (
                    <div className="px-6 py-8 text-center text-xs text-zinc-600">
                      Loading members...
                    </div>
                  ) : groupMembers.length === 0 ? (
                    <div className="px-6 py-8 text-center text-xs text-zinc-600">
                      No members found.
                    </div>
                  ) : (
                    <div className="px-2 pb-4">
                      {groupMembers.map((member) => {
                        const memberId = getUserId(member);
                        const isAdmin = groupAdmins.includes(memberId);
                        const isCurrentUser = memberId === currentUserId;
                        const isOnline =
                          onlineUsers[memberId] ?? member.isOnline ?? false;

                        return (
                          <div
                            key={memberId}
                            className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-zinc-900/60"
                          >
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm font-medium text-zinc-300">
                              {member.avatar ? (
                                <img
                                  src={member.avatar}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                (member.name || member.username || "?")
                                  .slice(0, 1)
                                  .toUpperCase()
                              )}

                              {isOnline && (
                                <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0e] bg-emerald-500" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-zinc-300">
                                  {member.name || member.username}
                                </p>

                                {isCurrentUser && (
                                  <span className="shrink-0 text-[9px] text-zinc-600">
                                    You
                                  </span>
                                )}
                              </div>

                              <p className="mt-0.5 truncate text-[11px] text-zinc-600">
                                @{member.username}
                              </p>
                            </div>

                            {isAdmin && (
                              <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[9px] font-medium text-zinc-500">
                                Admin
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <NewConversationModal
        open={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onConversationCreated={handleNewConversation}
      />

      <NewGroupModal
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        onCreated={handleNewGroup}
      />
    </div>
  );
}
