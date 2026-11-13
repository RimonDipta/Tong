import { Check, Loader2, Search, Users, X } from "lucide-react";

import { useEffect, useState } from "react";

import api from "../lib/api";
import type { Conversation } from "../types/chat";
import type { User } from "../types/auth";

interface NewGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}

export default function NewGroupModal({
  open,
  onClose,
  onCreated,
}: NewGroupModalProps) {
  const [name, setName] = useState("");

  const [query, setQuery] = useState("");

  const [users, setUsers] = useState<User[]>([]);

  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  const [searching, setSearching] = useState(false);

  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setQuery("");
      setUsers([]);
      setSelectedUsers([]);
      setSearching(false);
      setCreating(false);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      setUsers([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        setError("");

        const response = await api.get("/users/search", {
          params: {
            q: cleanQuery,
          },
        });

        const results = response.data.users || [];

        setUsers(results);
      } catch (error: any) {
        setUsers([]);

        setError(error?.response?.data?.message || "Failed to search users.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query, open]);

  function toggleUser(selectedUser: User) {
    const selectedUserId = selectedUser._id || selectedUser.id;

    if (!selectedUserId) {
      return;
    }

    const alreadySelected = selectedUsers.some(
      (user) => (user._id || user.id) === selectedUserId,
    );

    if (alreadySelected) {
      setSelectedUsers((current) =>
        current.filter((user) => (user._id || user.id) !== selectedUserId),
      );

      return;
    }

    if (selectedUsers.length >= 99) {
      setError("A group cannot contain more than 100 members.");

      return;
    }

    setSelectedUsers((current) => [...current, selectedUser]);

    setError("");
  }

  function removeUser(userId: string) {
    setSelectedUsers((current) =>
      current.filter((user) => (user._id || user.id) !== userId),
    );
  }

  function isSelected(userId: string) {
    return selectedUsers.some((user) => (user._id || user.id) === userId);
  }

  async function handleCreateGroup() {
    setError("");

    const cleanName = name.trim();

    if (!cleanName) {
      setError("Enter a group name.");

      return;
    }

    if (cleanName.length > 100) {
      setError("Group name cannot exceed 100 characters.");

      return;
    }

    if (selectedUsers.length < 2) {
      setError("Select at least 2 other users.");

      return;
    }

    const participantIds = selectedUsers
      .map((user) => user._id || user.id)
      .filter((id): id is string => Boolean(id));

    if (participantIds.length !== selectedUsers.length) {
      setError("One or more selected users are invalid.");

      return;
    }

    try {
      setCreating(true);

      const response = await api.post("/conversations/group", {
        name: cleanName,
        participantIds,
      });

      const conversation = response.data.conversation as Conversation;

      onCreated(conversation);

      onClose();
    } catch (error: any) {
      setError(error?.response?.data?.message || "Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b0b0e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
              <Users size={18} />
            </div>

            <div>
              <h2 className="text-sm font-medium text-zinc-200">New group</h2>

              <p className="text-[11px] text-zinc-600">
                Create a group conversation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-900 hover:text-zinc-300"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label
              htmlFor="group-name"
              className="mb-2 block text-xs font-medium text-zinc-400"
            >
              Group name
            </label>

            <input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="e.g. Development Team"
              className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
            />
          </div>

          <div>
            <label
              htmlFor="group-search"
              className="mb-2 block text-xs font-medium text-zinc-400"
            >
              Add members
            </label>

            <div className="flex h-11 items-center rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 focus-within:border-zinc-600">
              <Search size={16} className="shrink-0 text-zinc-600" />

              <input
                id="group-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or username..."
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
              />

              {searching && (
                <Loader2 size={15} className="animate-spin text-zinc-600" />
              )}
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500">
                  Selected members
                </span>

                <span className="text-[10px] text-zinc-700">
                  {selectedUsers.length}
                  /99
                </span>
              </div>

              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                {selectedUsers.map((user) => {
                  const userId = user._id || user.id || user.username;

                  return (
                    <div
                      key={userId}
                      className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          user.name?.slice(0, 1).toUpperCase()
                        )}
                      </div>

                      <span className="max-w-28 truncate text-[11px] text-zinc-400">
                        {user.name}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeUser(userId)}
                        className="text-zinc-700 transition hover:text-zinc-300"
                        aria-label={`Remove ${user.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {query.trim().length >= 2 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950">
              {searching ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-zinc-600">
                  <Loader2 size={15} className="animate-spin" />
                  Searching...
                </div>
              ) : users.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-600">
                  No users found.
                </div>
              ) : (
                users.map((user) => {
                  const userId = user._id || user.id;

                  if (!userId) {
                    return null;
                  }

                  const selected = isSelected(userId);

                  return (
                    <button
                      key={userId}
                      type="button"
                      onClick={() => toggleUser(user)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-zinc-900"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs font-medium text-zinc-400">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          user.name?.slice(0, 1).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-300">
                          {user.name}
                        </p>

                        <p className="truncate text-[11px] text-zinc-600">
                          @{user.username}
                        </p>
                      </div>

                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                            : "border-zinc-700 text-transparent"
                        }`}
                      >
                        <Check size={12} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="h-10 rounded-lg px-4 text-xs font-medium text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={creating}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              {creating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Users size={14} />
                  Create group
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
