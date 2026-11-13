import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-lg font-bold text-zinc-900">
            T
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {title}
          </h1>

          <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[var(--surface)] p-6">
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">{footer}</p>
      </div>
    </main>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

/*
 * Labelled input with inline error. Errors show
 * after blur and clear as soon as the value is
 * valid again (the parent controls `error`).
 */
export function Field({ id, label, hint, error, type, ...props }: FieldProps) {
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>

      <div
        className={`field flex items-center ${
          error ? "border-red-800 focus-within:border-red-600" : ""
        }`}
      >
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200"
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
