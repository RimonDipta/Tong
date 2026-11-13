import {
  Camera,
  Check,
  LogOut,
  MoreVertical,
  Pencil,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import api, { getErrorMessage } from "../../lib/api";
import { formatLastSeen, getUserId, pluralize } from "../../lib/chat";
import type { User } from "../../types/auth";
import type { Conversation } from "../../types/chat";

import Avatar from "../ui/Avatar";
import { Spinner, useConfirm } from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";

import AddMembersModal from "./AddMembersModal";

interface InfoPanelProps {
  conversation: Conversation;
  currentUserId: string;
  title: string;
  isOnline: (user?: User) => boolean;
  lastSeenFor: (user?: User) => string | undefined;
  onClose: () => void;
  onConversationChange: (conversation: Conversation) => void;
  onLeft: (conversationId: string) => void;
}

/*
 * Right-hand drawer: contact profile for direct
 * chats, member management for groups.
 */
export default function InfoPanel(props: InfoPanelProps) {
  const { onClose } = props;

  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKey);

    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="fade-in absolute inset-0 cursor-default bg-black/50"
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label="Conversation details"
        className="panel-enter relative flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-[var(--surface)] shadow-2xl shadow-black/50 outline-none"
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            {props.conversation.type === "group" ? "Group info" : "Contact info"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {props.conversation.type === "group" ? (
            <GroupDetails {...props} />
          ) : (
            <ContactDetails {...props} />
          )}
        </div>
      </aside>
    </div>
  );
}

function ContactDetails({
  conversation,
  currentUserId,
  isOnline,
  lastSeenFor,
}: InfoPanelProps) {
  const other = conversation.participants.find(
    (user) => getUserId(user) !== currentUserId,
  );

  if (!other) {
    return (
      <p className="px-6 py-10 text-center text-sm text-zinc-500">
        This account no longer exists.
      </p>
    );
  }

  const online = isOnline(other);

  return (
    <div className="px-6 pb-8 pt-4 text-center">
      <Avatar
        name={other.name}
        src={other.avatar}
        size="xl"
        online={online}
        className="mx-auto"
      />

      <h3 className="mt-4 text-lg font-semibold text-zinc-50">{other.name}</h3>

      <p className="text-sm text-zinc-500">@{other.username}</p>

      <p className={`mt-1 text-xs ${online ? "text-emerald-400" : "text-zinc-500"}`}>
        {online ? "Online" : formatLastSeen(lastSeenFor(other))}
      </p>

      {other.bio && (
        <div className="mt-6 rounded-xl border border-zinc-800 p-4 text-left">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            About
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-300">
            {other.bio}
          </p>
        </div>
      )}
    </div>
  );
}

function GroupDetails({
  conversation,
  currentUserId,
  title,
  isOnline,
  onConversationChange,
  onLeft,
}: InfoPanelProps) {
  const toast = useToast();
  const confirm = useConfirm();

  const admins = new Set((conversation.admins || []).map(String));

  const isAdmin = admins.has(currentUserId);

  const [renaming, setRenaming] = useState(false);

  const [name, setName] = useState(conversation.name || "");

  const [savingName, setSavingName] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [addingMembers, setAddingMembers] = useState(false);

  const [memberMenu, setMemberMenu] = useState<string | null>(null);

  const [busyMember, setBusyMember] = useState<string | null>(null);

  const [leaving, setLeaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!memberMenu) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest("[data-member-menu]")) {
        setMemberMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointer);

    return () => document.removeEventListener("mousedown", handlePointer);
  }, [memberMenu]);

  /*
   * Admins first, then you, then alphabetical.
   */
  const members = [...conversation.participants].sort((a, b) => {
    const aAdmin = admins.has(getUserId(a)) ? 0 : 1;
    const bAdmin = admins.has(getUserId(b)) ? 0 : 1;

    if (aAdmin !== bAdmin) {
      return aAdmin - bAdmin;
    }

    if (getUserId(a) === currentUserId) return -1;
    if (getUserId(b) === currentUserId) return 1;

    return a.name.localeCompare(b.name);
  });

  async function saveName(event: React.FormEvent) {
    event.preventDefault();

    const clean = name.trim();

    if (!clean || clean === conversation.name) {
      setRenaming(false);
      setName(conversation.name || "");
      return;
    }

    try {
      setSavingName(true);

      const response = await api.patch(`/conversations/${conversation._id}`, {
        name: clean,
      });

      onConversationChange(response.data.conversation);
      setRenaming(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't rename the group."));
    } finally {
      setSavingName(false);
    }
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }

    try {
      setUploading(true);

      const form = new FormData();
      form.append("avatar", file);

      const response = await api.post(
        `/conversations/${conversation._id}/avatar`,
        form,
      );

      onConversationChange(response.data.conversation);
      toast.success("Group photo updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't update the photo."));
    } finally {
      setUploading(false);
    }
  }

  async function memberAction(
    member: User,
    action: "promote" | "demote" | "remove",
  ) {
    const memberId = getUserId(member);

    setMemberMenu(null);

    if (action === "remove") {
      const ok = await confirm({
        title: `Remove ${member.name}?`,
        description: `${member.name} will no longer see new messages in ${title}.`,
        confirmLabel: "Remove",
        destructive: true,
      });

      if (!ok) {
        return;
      }
    }

    try {
      setBusyMember(memberId);

      const base = `/conversations/${conversation._id}`;

      const response =
        action === "remove"
          ? await api.delete(`${base}/members/${memberId}`)
          : action === "promote"
            ? await api.post(`${base}/admins/${memberId}`)
            : await api.delete(`${base}/admins/${memberId}`);

      onConversationChange(response.data.conversation);
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't update this member."));
    } finally {
      setBusyMember(null);
    }
  }

  async function leave() {
    const lastAdmin = isAdmin && admins.size === 1;

    const ok = await confirm({
      title: `Leave ${title}?`,
      description: lastAdmin
        ? "You're the only admin, so another member will be made admin. You won't get new messages from this group."
        : "You won't get new messages from this group unless someone adds you back.",
      confirmLabel: "Leave group",
      destructive: true,
    });

    if (!ok) {
      return;
    }

    try {
      setLeaving(true);

      await api.post(`/conversations/${conversation._id}/leave`);

      onLeft(conversation._id);
      toast.show(`You left ${title}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Couldn't leave the group."));
      setLeaving(false);
    }
  }

  return (
    <>
      <div className="px-6 pb-6 pt-2 text-center">
        <div className="relative mx-auto w-fit">
          <Avatar
            name={title}
            src={conversation.avatar}
            group={!conversation.avatar}
            size="xl"
          />

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-zinc-100 text-zinc-900 transition hover:bg-white disabled:opacity-60"
                aria-label="Change group photo"
                title="Change group photo"
              >
                {uploading ? <Spinner size={14} /> : <Camera size={14} />}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhoto}
                className="hidden"
              />
            </>
          )}
        </div>

        {renaming ? (
          <form onSubmit={saveName} className="mt-4 flex items-center gap-1.5">
            <label htmlFor="group-rename" className="sr-only">
              Group name
            </label>

            <input
              id="group-rename"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setRenaming(false);
                  setName(conversation.name || "");
                }
              }}
              maxLength={100}
              className="field h-9 min-w-0 flex-1 px-3 text-center"
            />

            <button
              type="submit"
              disabled={savingName}
              className="icon-btn bg-zinc-100 text-zinc-900 hover:bg-white hover:text-zinc-900"
              aria-label="Save group name"
            >
              {savingName ? <Spinner size={15} /> : <Check size={16} />}
            </button>
          </form>
        ) : (
          <div className="mt-4 flex items-center justify-center gap-1">
            <h3 className="truncate text-lg font-semibold text-zinc-50">
              {title}
            </h3>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="icon-btn h-7 w-7"
                aria-label="Rename group"
                title="Rename group"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}

        <p className="mt-0.5 text-sm text-zinc-500">
          Group · {pluralize(conversation.participants.length, "member")}
        </p>
      </div>

      <section className="border-t border-zinc-800/70 px-3 py-4" aria-labelledby="members-heading">
        <div className="mb-2 flex items-center justify-between px-3">
          <h4
            id="members-heading"
            className="text-[11px] font-medium uppercase tracking-wider text-zinc-500"
          >
            Members
          </h4>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddingMembers(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-200">
              <UserPlus size={17} />
            </span>
            Add members
          </button>
        )}

        <ul>
          {members.map((member) => {
            const memberId = getUserId(member);
            const memberIsAdmin = admins.has(memberId);
            const isYou = memberId === currentUserId;
            const canManage = isAdmin && !isYou;

            return (
              <li
                key={memberId}
                className="relative flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-zinc-900/60"
              >
                <Avatar
                  name={member.name}
                  src={member.avatar}
                  online={isOnline(member)}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">
                    {isYou ? "You" : member.name}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    @{member.username}
                  </span>
                </span>

                {memberIsAdmin && (
                  <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                    Admin
                  </span>
                )}

                {canManage && (
                  <div data-member-menu className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setMemberMenu(memberMenu === memberId ? null : memberId)
                      }
                      disabled={busyMember === memberId}
                      className="icon-btn h-8 w-8"
                      aria-label={`Manage ${member.name}`}
                      aria-expanded={memberMenu === memberId}
                    >
                      {busyMember === memberId ? (
                        <Spinner size={14} />
                      ) : (
                        <MoreVertical size={16} />
                      )}
                    </button>

                    {memberMenu === memberId && (
                      <div
                        role="menu"
                        className="fade-in absolute right-0 top-9 z-10 w-48 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-xl shadow-black/50"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            memberAction(member, memberIsAdmin ? "demote" : "promote")
                          }
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                        >
                          {memberIsAdmin ? (
                            <ShieldOff size={14} />
                          ) : (
                            <ShieldCheck size={14} />
                          )}
                          {memberIsAdmin ? "Remove as admin" : "Make admin"}
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => memberAction(member, "remove")}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
                        >
                          <UserMinus size={14} />
                          Remove from group
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="border-t border-zinc-800/70 p-3">
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-400 transition hover:bg-red-950/30 disabled:opacity-60"
        >
          {leaving ? <Spinner size={17} /> : <LogOut size={17} />}
          Leave group
        </button>
      </div>

      <AddMembersModal
        open={addingMembers}
        conversation={conversation}
        onClose={() => setAddingMembers(false)}
        onAdded={onConversationChange}
      />
    </>
  );
}
