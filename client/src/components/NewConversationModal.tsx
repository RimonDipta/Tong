import { MessageSquarePlus, Search } from "lucide-react";
import { useState } from "react";

import { useUserSearch } from "../hooks/useUserSearch";
import api, { getErrorMessage } from "../lib/api";
import { getUserId } from "../lib/chat";
import type { User } from "../types/auth";
import type { Conversation } from "../types/chat";

import Avatar from "./ui/Avatar";
import { Spinner } from "./ui/ConfirmDialog";
import Modal from "./ui/Modal";

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: Conversation) => void;
}

export default function NewConversationModal({
  open,
  onClose,
  onConversationCreated,
}: NewConversationModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      description="Find someone by name or username."
      icon={<MessageSquarePlus size={18} />}
    >
      {open && (
        <PersonSearch
          onClose={onClose}
          onConversationCreated={onConversationCreated}
        />
      )}
    </Modal>
  );
}

function PersonSearch({
  onClose,
  onConversationCreated,
}: Omit<NewConversationModalProps, "open">) {
  const [query, setQuery] = useState("");

  const [pendingId, setPendingId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const { results, searching, error: searchError, active } =
    useUserSearch(query);

  async function startConversation(user: User) {
    const userId = getUserId(user);

    try {
      setPendingId(userId);
      setError("");

      const response = await api.post("/conversations/direct", { userId });

      onConversationCreated(response.data.conversation);
      onClose();
    } catch (createError) {
      setError(getErrorMessage(createError, "Couldn't start the conversation."));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="px-5 py-5">
      <label htmlFor="person-search" className="sr-only">
        Search people
      </label>

      <div className="field flex items-center gap-2 px-3">
        <Search size={16} className="shrink-0 text-zinc-500" aria-hidden />

        <input
          id="person-search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or username"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />

        {searching && <Spinner size={15} />}
      </div>

      {(error || searchError) && (
        <p role="alert" className="alert-error mt-3">
          {error || searchError}
        </p>
      )}

      <div className="mt-3 min-h-48">
        {!active ? (
          <p className="py-10 text-center text-xs text-zinc-600">
            Type at least 2 characters to search.
          </p>
        ) : !searching && results.length === 0 ? (
          <p className="py-10 text-center text-xs text-zinc-600">
            No one found for “{query.trim()}”.
          </p>
        ) : (
          <ul className="-mx-2">
            {results.map((user) => {
              const id = getUserId(user);

              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => startConversation(user)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-zinc-900 disabled:opacity-60"
                  >
                    <Avatar
                      name={user.name}
                      src={user.avatar}
                      online={user.isOnline}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-200">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        @{user.username}
                      </span>
                    </span>

                    {pendingId === id && <Spinner size={15} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
