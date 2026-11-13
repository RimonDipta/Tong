import { Users } from "lucide-react";
import { useState } from "react";

import api, { getErrorMessage } from "../lib/api";
import { getUserId } from "../lib/chat";
import type { User } from "../types/auth";
import type { Conversation } from "../types/chat";

import UserPicker from "./UserPicker";
import { Spinner } from "./ui/ConfirmDialog";
import Modal from "./ui/Modal";

interface NewGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}

const MIN_OTHER_MEMBERS = 2;

export default function NewGroupModal({
  open,
  onClose,
  onCreated,
}: NewGroupModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group"
      description="Name it and add at least two people."
      icon={<Users size={18} />}
    >
      {open && <NewGroupForm onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

/*
 * Mounted only while the modal is open so the
 * form starts empty every time.
 */
function NewGroupForm({
  onClose,
  onCreated,
}: Omit<NewGroupModalProps, "open">) {
  const [name, setName] = useState("");

  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState<User[]>([]);

  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");

  function toggle(user: User) {
    const id = getUserId(user);

    setSelected((current) =>
      current.some((item) => getUserId(item) === id)
        ? current.filter((item) => getUserId(item) !== id)
        : [...current, user],
    );

    setError("");
  }

  const missing = MIN_OTHER_MEMBERS - selected.length;

  const canCreate = name.trim().length > 0 && missing <= 0 && !creating;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!canCreate) {
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await api.post("/conversations/group", {
        name: name.trim(),
        participantIds: selected.map(getUserId),
      });

      onCreated(response.data.conversation as Conversation);
      onClose();
    } catch (createError) {
      setError(getErrorMessage(createError, "Couldn't create the group."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-5 px-5 py-5">
        <div>
          <label htmlFor="group-name" className="field-label">
            Group name
          </label>

          <input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            placeholder="e.g. Weekend trip"
            autoComplete="off"
            className="field h-10 w-full px-3"
          />
        </div>

        <UserPicker
          query={query}
          onQueryChange={setQuery}
          selected={selected}
          onToggle={toggle}
          inputId="group-search"
        />

        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-zinc-800/80 bg-[var(--surface)] px-5 py-4">
        <p className="text-xs text-zinc-500">
          {missing > 0
            ? `Add ${missing} more ${missing === 1 ? "person" : "people"}`
            : `${selected.length + 1} members including you`}
        </p>

        <button type="submit" disabled={!canCreate} className="btn-primary">
          {creating ? <Spinner size={14} /> : <Users size={14} />}
          {creating ? "Creating…" : "Create group"}
        </button>
      </div>
    </form>
  );
}
