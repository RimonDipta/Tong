import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await register(name, username, email, password);
      navigate("/chat");
    } catch (error: any) {
      setError(
        error?.response?.data?.message ?? "Unable to create your account.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-bold text-black">
            T
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Join Tong and start talking.
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

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Name</label>

              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Username
              </label>

              <input
                type="text"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="rimon"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />

              <p className="mt-1.5 text-xs text-zinc-600">
                Letters, numbers, and underscores only.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">Email</label>

              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Password
              </label>

              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-white hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
