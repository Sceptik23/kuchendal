"use client";

import { useState } from "react";
import { useAuthStore } from "../store/authStore";

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const error = useAuthStore((s) => s.error);
  const pendingConfirmation = useAuthStore((s) => s.pendingConfirmation);

  if (pendingConfirmation) {
    return <p>Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === "signin") {
          void signIn(email, password);
        } else {
          void signUp(email, password, username);
        }
      }}
    >
      <h1>Kuchendal</h1>
      <div>
        <button type="button" onClick={() => setMode("signin")} disabled={mode === "signin"}>
          Connexion
        </button>
        <button type="button" onClick={() => setMode("signup")} disabled={mode === "signup"}>
          Inscription
        </button>
      </div>

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label htmlFor="password">Mot de passe</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />

      {mode === "signup" && (
        <>
          <label htmlFor="username">Pseudo</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </>
      )}

      <button type="submit">{mode === "signin" ? "Se connecter" : "Créer mon compte"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
