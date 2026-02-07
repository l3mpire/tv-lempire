"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Signup failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      {/* Background */}
      <div className="dash-bg">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-vignette" />
      </div>
      <div className="dash-noise" />

      {/* Signup card */}
      <div className="login-card">
        <div className="login-brand">lempire</div>
        <div className="login-title">Create Account</div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="name" className="login-label">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="login-input"
              placeholder="Your name"
              required
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder="Min. 6 characters"
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
            {loading ? "..." : "Sign Up"}
          </button>

          <div className="login-link">
            <Link href="/login">Already have an account? Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
