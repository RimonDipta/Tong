import { useEffect, useState } from "react";
import api from "../lib/api";
import type { User } from "../types/auth";

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: any) => void;
}

export default function NewConversationModal({
  open,
  onClose,
  onConversationCreated,
}: NewConversationModalProps) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setUsers([]);
      setError("");
      return;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setUsers([]);
      setError("");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/users/search", {
          params: {
            q: trimmedQuery,
          },
        });

        setUsers(response.data.users || []);
      } catch (error) {
        console.error("Failed to search users:", error);
        setError("Failed to search users");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  async function handleCreateConversation(user: User) {
    const userId = user._id || user.id;

    if (!userId) {
      console.error("Selected user does not have an ID:", user);

      setError("This user does not have a valid ID.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      console.log("Creating conversation with user:", userId);

      const response = await api.post("/conversations/direct", {
        userId,
      });

      console.log("Conversation created:", response.data);

      onConversationCreated(response.data.conversation);

      onClose();
    } catch (error: any) {
      console.error("Failed to create conversation:", error);

      console.error("Server response:", error?.response?.data);

      setError(
        error?.response?.data?.message || "Failed to create conversation",
      );
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-medium text-white">New conversation</h2>

            <p className="mt-1 text-xs text-zinc-500">
              Search for someone to start chatting with.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-5">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" strokeLinecap="round" />
            </svg>

            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or username..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Results */}
          <div className="mt-4 max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-10 text-xs text-zinc-500">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
                Searching...
              </div>
            )}

            {!loading &&
              query.trim().length >= 2 &&
              users.length === 0 &&
              !error && (
                <div className="py-10 text-center text-xs text-zinc-600">
                  No users found.
                </div>
              )}

            {!loading &&
              users.map((user) => {
                const userId = user._id || user.id;

                return (
                  <button
                    key={userId || user.username}
                    type="button"
                    disabled={creating}
                    onClick={() => handleCreateConversation(user)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-medium text-white">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user.name?.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* User information */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {user.name}
                        </span>

                        {user.isVerified && (
                          <span className="text-[10px] text-blue-400">✓</span>
                        )}
                      </div>

                      <p className="truncate text-xs text-zinc-500">
                        @{user.username}
                      </p>
                    </div>

                    {/* Loading indicator */}
                    {creating && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
