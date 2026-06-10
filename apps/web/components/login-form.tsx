"use client";

import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/projects";
  const [email, setEmail] = useState("founder@example.com");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send code");
      }

      setStep("code");
      setCode("123456");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const payload = (await response.json()) as { error?: string, accessToken?: string };

      if (!response.ok || !payload.accessToken) {
        throw new Error(payload.error ?? "Could not verify code");
      }

      // Set cookie for Next.js to read
      document.cookie = `ff_access_token=${payload.accessToken}; path=/; max-age=604800; samesite=lax`;

      router.push(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card card">
      <div className="card-header">
        <div>
          <h1>Sign in</h1>
          <p>Use the local OTP flow to continue.</p>
        </div>
      </div>
      <div className="card-body">
        {step === "email" ? (
          <form className="form" onSubmit={sendCode}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error ? <div className="error compact">{error}</div> : null}
            <button className="button primary" disabled={loading} type="submit">
              <Mail size={16} aria-hidden="true" />
              {loading ? "Sending code" : "Send code"}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={verifyCode}>
            <div className="notice">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>Use local code <strong>123456</strong>. Supabase OTP will replace this later.</span>
            </div>
            <div className="field">
              <label htmlFor="login-code">Verification code</label>
              <input
                id="login-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            {error ? <div className="error compact">{error}</div> : null}
            <button className="button primary" disabled={loading || code.length !== 6} type="submit">
              <ArrowRight size={16} aria-hidden="true" />
              {loading ? "Verifying" : "Continue"}
            </button>
            <button className="button" type="button" onClick={() => setStep("email")}>
              Change email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
