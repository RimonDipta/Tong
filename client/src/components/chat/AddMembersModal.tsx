import { UserPlus } from "lucide-react";
import { useState } from "react";

import api, { getErrorMessage } from "../../lib/api";
import { getUserId, pluralize } from "../../lib/chat";
import type { User } from "../../types/auth";
import type { Conversation } from "../../types/chat";

import UserPicker from "../UserPicker";
import { Spinner } from "../ui/ConfirmDialog";
import Modal from "../ui/Modal";

interface AddMembersModalProps {
  open: boolean;
  conversation: Conversation;
  onClose: () => void;
  onAdded: (conversation: Conversation) => void;
}

export default function AddMembersModal({
  open,
  conversation,
  onClose,
  onAdded,
}: AddMembersModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add members"
      description={conversation.name}
      icon={<UserPlus size={18} />}
    >
      {open && (
        <AddMembersForm
          conversation={conversation}
          onClose={onClose}
          onAdded={onAdded}
        />
      )}
    </Modal>
  );
}

function AddMembersForm({
  conversation,
  onClose,
  onAdded,
}: Omit<AddMembersModalProps, "open">) {
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState<User[]>([]);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const memberIds = conversation.participants.map(getUserId);

  function toggle(user: User) {
    const id = getUserId(user);

    setSelected((current) =>
      current.some((item) => getUserId(item) === id)
        ? current.filter((item) => getUserId(item) !== id)
        : [...current, user],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (selected.length === 0 || saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await api.post(
        `/conversations/${conversation._id}/members`,
        { participantIds: selected.map(getUserId) },
      );

      onAdded(response.data.conversation);
      onClose();
    } catch (addError) {
      setError(getErrorMessage(addError, "Couldn't add members."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 px-5 py-5">
        <UserPicker
          query={query}
          onQueryChange={setQuery}
          selected={selected}
          onToggle={toggle}
          excludeIds={memberIds}
          inputId="add-members-search"
        />

        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-zinc-800/80 bg-[var(--surface)] px-5 py-4">
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>

        <button
          type="submit"
          disabled={selected.length === 0 || saving}
          className="btn-primary"
        >
          {saving && <Spinner size={14} />}
          {selected.length === 0
            ? "Add members"
            : `Add ${pluralize(selected.length, "member")}`}
        </button>
      </div>
    </form>
  );
}
