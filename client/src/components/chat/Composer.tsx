import { FileText, Paperclip, Pencil, Reply, SendHorizontal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  ACCEPTED_FILE_TYPES,
  formatFileSize,
  getUserId,
  mergeFiles,
} from "../../lib/chat";
import type { Message } from "../../types/chat";

import { Spinner } from "../ui/ConfirmDialog";

const MAX_LENGTH = 5000;

/*
 * Unsent text per conversation, kept for the
 * session so switching chats doesn't lose it.
 */
const drafts = new Map<string, string>();

const previewUrls = new Map<File, string>();

function previewFor(file: File) {
  let url = previewUrls.get(file);

  if (!url) {
    url = URL.createObjectURL(file);
    previewUrls.set(file, url);
  }

  return url;
}

interface ComposerProps {
  conversationId: string;
  currentUserId: string;
  replyTo: Message | null;
  editing: Message | null;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onFileError: (message: string) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (content: string) => Promise<boolean>;
  onSaveEdit: (content: string) => Promise<boolean>;
  onEditLast: () => void;
  onTyping: () => void;
  onStopTyping: () => void;
}

export default function Composer({
  conversationId,
  currentUserId,
  replyTo,
  editing,
  files,
  onFilesChange,
  onFileError,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onEditLast,
  onTyping,
  onStopTyping,
}: ComposerProps) {
  const [text, setText] = useState(() => drafts.get(conversationId) || "");

  const [sending, setSending] = useState(false);

  /*
   * Draft that was in the box before an edit
   * started; restored when the edit ends.
   */
  const [stash, setStash] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  if (editing?._id !== editingId) {
    setEditingId(editing?._id);

    if (editing) {
      setStash((current) => current ?? text);
      setText(editing.content);
    } else {
      setText(stash ?? "");
      setStash(null);
    }
  }

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    drafts.set(conversationId, editing ? (stash ?? "") : text);
  }, [conversationId, editing, stash, text]);

  /*
   * Free image previews for files that were
   * removed or sent.
   */
  useEffect(() => {
    for (const [file, url] of previewUrls) {
      if (!files.includes(file)) {
        URL.revokeObjectURL(url);
        previewUrls.delete(file);
      }
    }
  }, [files]);

  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches || editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  useLayoutEffect(() => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [text]);

  const trimmed = text.trim();

  const canSend =
    !sending &&
    trimmed.length <= MAX_LENGTH &&
    (editing ? trimmed.length > 0 && trimmed !== editing.content : trimmed.length > 0 || files.length > 0);

  async function submit() {
    if (!canSend) {
      return;
    }

    onStopTyping();

    const content = text;

    setSending(true);

    if (editing) {
      const ok = await onSaveEdit(trimmed);

      setSending(false);

      if (ok) {
        onCancelEdit();
      }

      return;
    }

    /*
     * Clear immediately so the composer feels
     * instant; restore the text if sending fails.
     */
    setText("");

    const ok = await onSend(content.trim());

    setSending(false);

    if (!ok) {
      setText(content);
    }

    textareaRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
      return;
    }

    if (event.key === "Escape") {
      if (editing) {
        event.preventDefault();
        onCancelEdit();
      } else if (replyTo) {
        event.preventDefault();
        onCancelReply();
      }

      return;
    }

    if (event.key === "ArrowUp" && !text && !editing && files.length === 0) {
      event.preventDefault();
      onEditLast();
    }
  }

  function addFiles(incoming: File[]) {
    if (incoming.length === 0) {
      return;
    }

    const result = mergeFiles(files, incoming);

    if (result.error) {
      onFileError(result.error);
      return;
    }

    onFilesChange(result.files);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.files);

    if (pasted.length > 0 && !editing) {
      event.preventDefault();
      addFiles(pasted);
    }
  }

  return (
    <div className="shrink-0 border-t border-zinc-800/70 bg-[var(--surface)] px-3 pb-3 pt-2 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {(replyTo || editing) && (
          <div className="fade-in mb-2 flex items-center gap-3 rounded-xl bg-zinc-900 px-3 py-2">
            {editing ? (
              <Pencil size={15} className="shrink-0 text-zinc-400" aria-hidden />
            ) : (
              <Reply size={15} className="shrink-0 text-zinc-400" aria-hidden />
            )}

            <div className="min-w-0 flex-1 border-l-2 border-zinc-600 pl-3">
              <p className="text-xs font-medium text-zinc-300">
                {editing
                  ? "Editing message"
                  : `Replying to ${
                      getUserId(replyTo!.sender) === currentUserId
                        ? "yourself"
                        : replyTo!.sender?.name
                    }`}
              </p>

              <p className="truncate text-xs text-zinc-500">
                {(editing || replyTo)!.content ||
                  (editing || replyTo)!.attachments?.[0]?.name ||
                  "Attachment"}
              </p>
            </div>

            <button
              type="button"
              onClick={editing ? onCancelEdit : onCancelReply}
              className="icon-btn h-7 w-7"
              aria-label={editing ? "Cancel editing" : "Cancel reply"}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {files.length > 0 && !editing && (
          <ul className="mb-2 flex gap-2 overflow-x-auto pb-1 pt-1.5" aria-label="Attachments">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`} className="relative shrink-0">
                <FileChip file={file} />

                <button
                  type="button"
                  onClick={() =>
                    onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))
                  }
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-1.5 transition focus-within:border-zinc-600">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) => {
              addFiles(Array.from(event.target.files || []));
              event.target.value = "";
            }}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(editing) || sending}
            className="icon-btn"
            aria-label="Attach files"
            title="Attach files (max 5, 10 MB each)"
          >
            <Paperclip size={18} />
          </button>

          <label htmlFor="message-input" className="sr-only">
            Message
          </label>

          <textarea
            id="message-input"
            ref={textareaRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value);

              if (!editing && event.target.value) {
                onTyping();
              }
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={onStopTyping}
            placeholder={editing ? "Edit your message" : "Message"}
            rows={1}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-5 text-zinc-100 outline-none placeholder:text-zinc-500"
          />

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 transition hover:bg-white disabled:bg-transparent disabled:text-zinc-600"
            aria-label={editing ? "Save edit" : "Send message"}
          >
            {sending ? <Spinner size={16} /> : <SendHorizontal size={17} />}
          </button>
        </div>

        {trimmed.length > MAX_LENGTH - 200 && (
          <p
            className={`mt-1 text-right text-[11px] ${
              trimmed.length > MAX_LENGTH ? "text-red-400" : "text-zinc-500"
            }`}
          >
            {trimmed.length}/{MAX_LENGTH}
          </p>
        )}
      </div>
    </div>
  );
}

function FileChip({ file }: { file: File }) {
  if (file.type.startsWith("image/")) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <img src={previewFor(file)} alt={file.name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-44 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
        <FileText size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-zinc-200">{file.name}</span>
        <span className="block text-[11px] text-zinc-500">{formatFileSize(file.size)}</span>
      </span>
    </div>
  );
}
