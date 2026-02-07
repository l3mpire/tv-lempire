"use client";

import Link from "next/link";

export default function PendingPage() {
  return (
    <div className="login-wrapper">
      {/* Background */}
      <div className="dash-bg">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-vignette" />
      </div>
      <div className="dash-noise" />

      {/* Card */}
      <div className="login-card">
        <div className="login-brand">lempire</div>
        <div className="login-title">Check your email</div>

        <div className="text-zinc-400 text-sm text-center space-y-4 mt-4">
          <p>
            We sent a verification link to your email address.
            Click the link to activate your account.
          </p>
          <p className="text-zinc-500 text-xs">
            Didn&apos;t receive it? Check your spam folder.
          </p>
        </div>

        <div className="login-link mt-6">
          <Link href="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
