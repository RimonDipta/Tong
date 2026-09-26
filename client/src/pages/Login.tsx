import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/chat");
    } catch (error: any) {
      setError(
        error?.response?.data?.message ?? "Unable to log in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-bold text-black">
            T
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Sign in to continue to Tong.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl"
        >
          {error && (
            <div className="mb-5 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-zinc-300"
                >
                  Password
                </label>

                <button
                  type="button"
                  className="text-xs text-zinc-500 transition hover:text-white"
                >
                  Forgot password?
                </button>
              </div>

              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-600">OR</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <p className="text-center text-sm text-zinc-500">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-white hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
