"use client";

import { useAuthStore } from "../store/authStore";
import styles from "./TopNav.module.css";

export type HubView = "home" | "profil" | "classements" | "parametres";

export interface TopNavProps {
  active: HubView;
  onNavigate: (view: HubView) => void;
}

const LINKS: { id: HubView; label: string }[] = [
  { id: "home", label: "Accueil" },
  { id: "profil", label: "Profil" },
  { id: "classements", label: "Classements" },
  { id: "parametres", label: "Paramètres" },
];

export function TopNav({ active, onNavigate }: TopNavProps) {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>KUCHENDAL</div>
      <div className={styles.links}>
        {LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onNavigate(link.id)}
            className={[styles.link, active === link.id ? styles.active : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {link.label}
          </button>
        ))}
        <button type="button" onClick={() => void signOut()} className={styles.link}>
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}
