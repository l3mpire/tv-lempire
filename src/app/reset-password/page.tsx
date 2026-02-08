"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="login-wrapper">
        <div className="dash-bg">
          <div className="dash-orb dash-orb-1" />
          <div className="dash-vignette" />
        </div>
        <div className="dash-noise" />
        <div className="login-card">
          <div className="login-brand">lempire</div>
          <div className="login-title">Invalid link</div>
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", margin: "16px 0" }}>
            This reset link is invalid or has already been used.
          </p>
          <div className="login-link">
            <Link href="/login">Back to login</Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-wrapper">
        <div className="dash-bg">
          <div className="dash-orb dash-orb-1" />
          <div className="dash-vignette" />
        </div>
        <div className="dash-noise" />
        <div className="login-card">
          <div className="login-brand">lempire</div>
          <div className="login-title">Password updated</div>
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", margin: "16px 0" }}>
            Your password has been reset successfully.
          </p>
          <div className="login-link" style={{ marginTop: "24px" }}>
            <Link href="/login">Sign in with your new password</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrapper">
      <div className="dash-bg">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-vignette" />
      </div>
      <div className="dash-noise" />

      <div className="login-card">
        <div className="login-brand">lempire</div>
        <div className="login-title">Choose a new password</div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="password" className="login-label">New password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder="••••••••"
              required
              minLength={6}
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="confirm" className="login-label">Confirm password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="login-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "..." : "Reset password"}
          </button>

          <div className="login-link">
            <Link href="/login">Back to login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
