import { useEffect, useState } from "react";

import api, { getErrorMessage } from "../lib/api";
import type { User } from "../types/auth";

interface SearchResult {
  query: string;
  users: User[];
  error: string;
}

/*
 * Debounced people search. Returns no results
 * until the query has at least 2 characters.
 * Results are tagged with the query they belong
 * to, so stale responses are never shown.
 */
export function useUserSearch(query: string, enabled = true) {
  const trimmed = query.trim();

  const active = enabled && trimmed.length >= 2;

  const [result, setResult] = useState<SearchResult>({
    query: "",
    users: [],
    error: "",
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const timeout = window.setTimeout(() => {
      api
        .get("/users/search", { params: { q: trimmed } })
        .then((response) => {
          if (!cancelled) {
            setResult({ query: trimmed, users: response.data.users || [], error: "" });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setResult({
              query: trimmed,
              users: [],
              error: getErrorMessage(error, "Couldn't search people."),
            });
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [active, trimmed]);

  const current = active && result.query === trimmed;

  return {
    results: current ? result.users : [],
    error: current ? result.error : "",
    searching: active && !current,
    active,
  };
}
