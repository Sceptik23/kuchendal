"use client";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";

export function JoinForm() {
  const [name, setName] = useState("");
  const join = useGameStore((s) => s.join);
  const error = useGameStore((s) => s.error);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) join(name.trim());
      }}
    >
      <h1>Kuhhandel Online</h1>
      <label htmlFor="playerName">Pseudo</label>
      <input
        id="playerName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ton pseudo"
        autoFocus
      />
      <button type="submit" disabled={!name.trim()}>
        Rejoindre la partie
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
