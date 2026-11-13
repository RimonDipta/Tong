import { Check, Search, X } from "lucide-react";

import { useUserSearch } from "../hooks/useUserSearch";
import { getUserId } from "../lib/chat";
import type { User } from "../types/auth";

import Avatar from "./ui/Avatar";
import { Spinner } from "./ui/ConfirmDialog";

interface UserPickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  selected: User[];
  onToggle: (user: User) => void;
  excludeIds?: string[];
  inputId?: string;
}

/*
 * Search-and-select list for picking several
 * people (new group, add members).
 */
export default function UserPicker({
  query,
  onQueryChange,
  selected,
  onToggle,
  excludeIds = [],
  inputId = "user-picker-search",
}: UserPickerProps) {
  const { results, searching, error, active } = useUserSearch(query);

  const excluded = new Set(excludeIds);

  const visible = results.filter((user) => !excluded.has(getUserId(user)));

  const selectedIds = new Set(selected.map(getUserId));

  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        Add people
      </label>

      <div className="field flex items-center gap-2 px-3">
        <Search size={16} className="shrink-0 text-zinc-500" aria-hidden />

        <input
          id={inputId}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name or username"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />

        {searching && <Spinner size={15} />}
      </div>

      {selected.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Selected people">
          {selected.map((user) => (
            <li key={getUserId(user)}>
              <button
                type="button"
                onClick={() => onToggle(user)}
                className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-2 text-xs text-zinc-300 transition hover:border-zinc-600"
                aria-label={`Remove ${user.name}`}
              >
                <Avatar name={user.name} src={user.avatar} size="xs" />
                <span className="max-w-28 truncate">{user.name}</span>
                <X size={12} className="text-zinc-500" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 min-h-40">
        {!active ? (
          <p className="px-1 py-8 text-center text-xs text-zinc-600">
            Type at least 2 characters to search.
          </p>
        ) : error ? (
          <p className="px-1 py-8 text-center text-xs text-red-400">{error}</p>
        ) : !searching && visible.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-zinc-600">
            No one found for “{query.trim()}”.
          </p>
        ) : (
          <ul className="-mx-2">
            {visible.map((user) => {
              const id = getUserId(user);
              const isSelected = selectedIds.has(id);

              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onToggle(user)}
                    aria-pressed={isSelected}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-zinc-900"
                  >
                    <Avatar name={user.name} src={user.avatar} size="md" />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-200">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        @{user.username}
                      </span>
                    </span>

                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                        isSelected
                          ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                          : "border-zinc-700 text-transparent"
                      }`}
                      aria-hidden
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
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
