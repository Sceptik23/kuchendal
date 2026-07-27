export const metadata = {
  title: "Kuhhandel Online",
  description: "Jeu multijoueur d'enchères et de bluff en temps réel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
