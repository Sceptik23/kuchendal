"use client";

import { useState } from "react";
import { Button, Input } from "@kuhhandel/ui";
import { useAuthStore } from "../store/authStore";
import styles from "./AuthForm.module.css";

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
    return (
      <div className={styles.page}>
        <div className={styles.swirl} />
        <div className={styles.content}>
          <p className={styles.pending}>
            Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.swirl} />
      <div className={styles.content}>
        <h1 className={styles.wordmark}>KUCHENDAL</h1>
        <p className={styles.tagline}>La foire aux bêtes la plus fluo du village.</p>

        <form
          className={styles.card}
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "signin") {
              void signIn(email, password);
            } else {
              void signUp(email, password, username);
            }
          }}
        >
          <div className={styles.tabs}>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={[styles.tab, mode === "signin" ? styles.tabActive : ""]
                .filter(Boolean)
                .join(" ")}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={[styles.tab, mode === "signup" ? styles.tabActive : ""]
                .filter(Boolean)
                .join(" ")}
            >
              Inscription
            </button>
          </div>

          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="toi@ferme.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.field}
          />

          <label htmlFor="password" className={styles.label}>
            Mot de passe
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={styles.field}
          />

          {mode === "signup" && (
            <>
              <label htmlFor="username" className={styles.label}>
                Pseudo
              </label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={styles.field}
              />
            </>
          )}

          <div className={styles.submitWrap}>
            <Button type="submit" variant="primary" className={styles.submit}>
              {mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </div>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
