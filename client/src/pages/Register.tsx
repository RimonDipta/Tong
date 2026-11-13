import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthShell, Field } from "../components/AuthShell";
import { Spinner } from "../components/ui/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = "name" | "username" | "email" | "password";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [values, setValues] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    name: false,
    username: false,
    email: false,
    password: false,
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const errors: Record<FieldName, string> = {
    name:
      values.name.trim().length < 2 ? "Name must be at least 2 characters." : "",
    username:
      values.username.length < 3
        ? "Username must be at least 3 characters."
        : "",
    email: EMAIL_PATTERN.test(values.email.trim())
      ? ""
      : "Enter a valid email address.",
    password:
      values.password.length < 8 ? "Use at least 8 characters." : "",
  };

  function bind(name: FieldName) {
    return {
      value: values[name],
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
      error: touched[name] ? errors[name] : "",
    };
  }

  function update(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setTouched({ name: true, username: true, email: true, password: true });

    if (Object.values(errors).some(Boolean)) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await register(
        values.name.trim(),
        values.username,
        values.email.trim(),
        values.password,
      );

      navigate("/chat", { replace: true });
    } catch (registerError) {
      setError(getErrorMessage(registerError, "Couldn't create your account."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Tong and start talking."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-zinc-100 hover:underline">
            Sign in
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
          id="name"
          label="Name"
          autoComplete="name"
          autoFocus
          maxLength={50}
          onChange={(event) => update("name", event.target.value)}
          {...bind("name")}
        />

        <Field
          id="username"
          label="Username"
          autoComplete="username"
          maxLength={30}
          hint="Letters, numbers and underscores."
          onChange={(event) =>
            update(
              "username",
              event.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase(),
            )
          }
          {...bind("username")}
        />

        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          onChange={(event) => update("email", event.target.value)}
          {...bind("email")}
        />

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          onChange={(event) => update("password", event.target.value)}
          {...bind("password")}
        />

        <button type="submit" disabled={loading} className="btn-primary h-11 w-full">
          {loading && <Spinner size={16} />}
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
