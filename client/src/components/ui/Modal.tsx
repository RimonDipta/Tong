import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
}

/*
 * Centered dialog with Escape-to-close, backdrop
 * click, and focus restored on close.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusTarget = panelRef.current?.querySelector<HTMLElement>(
      "[autofocus], input, textarea, button:not([data-close])",
    );

    focusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal-enter flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-[var(--surface)] shadow-2xl shadow-black/50 sm:rounded-2xl ${
          size === "sm" ? "sm:max-w-sm" : "sm:max-w-md"
        }`}
      >
        <div className="flex items-start gap-3 border-b border-zinc-800/80 px-5 py-4">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
              {icon}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-sm font-semibold text-zinc-100">
              {title}
            </h2>

            {description && (
              <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
            )}
          </div>

          <button
            type="button"
            data-close
            onClick={onClose}
            className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
