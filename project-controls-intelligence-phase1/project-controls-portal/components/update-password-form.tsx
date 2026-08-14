"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 10) {
      setMessage("Use at least 10 characters.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="form-heading">
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h1>Create a new password</h1>
        <p>Use a strong password that is unique to this portal.</p>
      </div>
      <label>
        <span>New password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={10}
          required
        />
      </label>
      {message ? <div className="form-message">{message}</div> : null}
      <button className="primary-button login-button" type="submit">
        Update password
      </button>
    </form>
  );
}
