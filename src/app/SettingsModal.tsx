"use client";

import { useState, useEffect, useCallback } from "react";

type SettingsModalProps = {
  onClose: () => void;
  onLogout: () => void;
};

export default function SettingsModal({ onClose, onLogout }: SettingsModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [nameFeedback, setNameFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwFeedback, setPwFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setEmail(data.user.email || "");
          setName(data.user.name || "");
          setOriginalName(data.user.name || "");
        }
      })
      .catch(() => {});
  }, []);

  // Auto-clear success feedback after 3s
  useEffect(() => {
    if (nameFeedback?.type === "success") {
      const t = setTimeout(() => setNameFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [nameFeedback]);

  useEffect(() => {
    if (pwFeedback?.type === "success") {
      const t = setTimeout(() => setPwFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [pwFeedback]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSaveName = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameFeedback({ type: "error", message: "Name cannot be empty" });
      return;
    }
    if (trimmed.length > 50) {
      setNameFeedback({ type: "error", message: "Name must be 50 characters or less" });
      return;
    }
    if (trimmed === originalName) {
      setNameFeedback({ type: "error", message: "Name is unchanged" });
      return;
    }

    setNameSaving(true);
    setNameFeedback(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setOriginalName(trimmed);
        setNameFeedback({ type: "success", message: "Updated (reload page to see changes)" });
      } else {
        setNameFeedback({ type: "error", message: data.error || "Failed to update name" });
      }
    } catch {
      setNameFeedback({ type: "error", message: "Network error" });
    } finally {
      setNameSaving(false);
    }
  }, [name, originalName]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword) {
      setPwFeedback({ type: "error", message: "Current password is required" });
      return;
    }
    if (newPassword.length < 6) {
      setPwFeedback({ type: "error", message: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwFeedback({ type: "error", message: "Passwords do not match" });
      return;
    }

    setPwSaving(true);
    setPwFeedback(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPwFeedback({ type: "success", message: "Password changed" });
      } else {
        setPwFeedback({ type: "error", message: data.error || "Failed to change password" });
      }
    } catch {
      setPwFeedback({ type: "error", message: "Network error" });
    } finally {
      setPwSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="help-close" onClick={onClose}>×</button>
        <h2>Settings</h2>

        {/* Profile section */}
        <div className="settings-section">
          <h3>Profile</h3>
          <div className="settings-field">
            <label className="settings-label">Email</label>
            <input className="settings-input" type="email" value={email} disabled />
          </div>
          <div className="settings-field">
            <label className="settings-label">Name</label>
            <div className="settings-inline">
              <input
                className="settings-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
              />
              <button
                className="settings-save-btn"
                onClick={handleSaveName}
                disabled={nameSaving || name.trim() === originalName}
              >
                {nameSaving ? "..." : "Save"}
              </button>
            </div>
          </div>
          {nameFeedback && (
            <div className={`settings-feedback settings-feedback-${nameFeedback.type}`}>
              {nameFeedback.message}
            </div>
          )}
        </div>

        {/* Password section */}
        <div className="settings-section">
          <h3>Password</h3>
          <div className="settings-field">
            <label className="settings-label">Current password</label>
            <input
              className="settings-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="settings-field">
            <label className="settings-label">New password</label>
            <input
              className="settings-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="settings-field">
            <label className="settings-label">Confirm new password</label>
            <input
              className="settings-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
            />
          </div>
          <button
            className="settings-save-btn settings-save-btn-full"
            onClick={handleChangePassword}
            disabled={pwSaving}
          >
            {pwSaving ? "Changing..." : "Change password"}
          </button>
          {pwFeedback && (
            <div className={`settings-feedback settings-feedback-${pwFeedback.type}`}>
              {pwFeedback.message}
            </div>
          )}
        </div>

        {/* Logout section */}
        <div className="settings-section settings-section-logout">
          <button className="settings-logout-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
