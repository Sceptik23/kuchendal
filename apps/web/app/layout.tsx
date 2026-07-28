import { Bungee, Space_Grotesk } from 'next/font/google';
import './globals.css';

const bungee = Bungee({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bungee',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata = {
  title: 'Kuchendal',
  description: "Jeu multijoueur d'enchères et de bluff en temps réel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bungee.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
