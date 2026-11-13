import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AuthShell, Field } from "../components/AuthShell";
import { Spinner } from "../components/ui/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailError = !email.trim()
    ? "Enter your email."
    : !EMAIL_PATTERN.test(email.trim())
      ? "Enter a valid email address."
      : "";

  const passwordError = password ? "" : "Enter your password.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);

      const from = (location.state as { from?: string } | null)?.from;

      navigate(from && from.startsWith("/chat") ? from : "/chat", {
        replace: true,
      });
    } catch (loginError) {
      setError(getErrorMessage(loginError, "Couldn't sign you in. Try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to Tong."
      footer={
        <>
          New to Tong?{" "}
          <Link to="/register" className="font-medium text-zinc-100 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}

        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched((value) => ({ ...value, email: true }))}
          error={touched.email ? emailError : ""}
          placeholder="you@example.com"
        />

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched((value) => ({ ...value, password: true }))}
          error={touched.password ? passwordError : ""}
        />

        <button type="submit" disabled={loading} className="btn-primary h-11 w-full">
          {loading && <Spinner size={16} />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
