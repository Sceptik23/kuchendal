# 02 — PRD PRODUIT

## 1. Comptes joueurs
- Inscription : username unique, mot de passe hashé (jamais stocké en clair), email optionnel pour récupération.
- Avatar (upload ou set d'avatars prédéfinis) + couleur préférée (utilisée dans l'UI de jeu pour identifier le joueur).
- Fiche permanente par joueur, ne se réinitialise jamais (sauf action explicite de l'utilisateur type "supprimer mon compte").
- Données conservées par compte :
  - Parties jouées / victoires / défaites.
  - Argent total gagné et perdu (cumulé toutes parties).
  - Nombre de bluffs tentés et réussis (un "bluff" = une offre de Kuhhandel où le montant misé diffère significativement de ce que la cible attendait — à instrumenter précisément, cf. `08_AI.md`).
  - Nombre de Kuhhandel lancés / gagnés.
  - Familles complétées, animal favori (le plus souvent collectionné).
  - Historique des parties (résumé consultable, pas le replay complet en v1).
  - Badges, succès, titres débloqués.
  - Cosmétiques et emotes débloqués.

## 2. Système social — Amis
- Recherche de joueurs par username.
- Envoi / acceptation / refus de demandes d'ami.
- Liste d'amis avec statut en temps réel : En ligne / En partie / Absent / Dernière connexion.
- Rejoindre directement la partie d'un ami en ligne (si le lobby le permet).
- Inviter plusieurs amis d'un coup à un lobby.

## 3. Lobby
- Types de lobby : public, privé, protégé par mot de passe.
- Partage via code court, QR code, lien d'invitation.
- Pouvoirs de l'hôte :
  - Modifier les règles/variantes activées.
  - Expulser un joueur.
  - Transférer le rôle d'hôte.
  - Ajouter des bots (IA) pour compléter la table.
  - Modifier le nombre de joueurs attendu.
  - Sauvegarder une partie en cours et la reprendre plus tard.

## 4. Profil joueur (page publique/consultable)
Affiche : avatar, niveau, XP, titre actif, classement, nombre de parties, historique récent, succès/badges obtenus, statistiques avancées, courbes de progression, animations débloquées, animal favori, records personnels (plus grosse enchère, plus gros bluff, plus grosse "arnaque" en Kuhhandel, plus gros comeback, plus grosse erreur).

## 5. Système XP et niveaux
- Actions génératrices d'XP : fin de partie, premier bluff, premier Kuhhandel, première victoire, série de victoires, jouer avec un nouvel ami, faire réagir les autres joueurs (réactions positives sur un coup), découvrir un événement rare, obtenir un badge, compléter une famille.
- Chaque niveau débloque un ou plusieurs éléments cosmétiques : cadre de profil, titre, emote, animation, effet visuel de carte, icône.
- Courbe d'XP par niveau à définir dans `07_META_GAME.md` (progression ni trop rapide ni frustrante).

## 6. Badges, succès, titres (détail complet dans `07_META_GAME.md`)
- Catalogue cible v1 : au moins 50 badges, 30 succès (dont succès cachés), 20 titres.
- Ambition long terme (post-v1) : jusqu'à 400+ badges, 100+ succès cachés, 300+ titres — à traiter comme un backlog de contenu, pas un bloquant du MVP.

## 7. Événements rares en partie
- Bibliothèque d'événements visuels/sonores à faible probabilité qui surviennent pendant une partie (ex. animation spéciale, ligne de narrateur inhabituelle), sans jamais casser l'équilibre du jeu (ils sont cosmétiques/narratifs, pas des bonus de gameplay qui fausseraient les règles officielles).
- V1 : bibliothèque restreinte (10-20 événements) pour valider le système technique ; extension ensuite.

## 8. Classements
- Portées : mondial, entre amis, hebdomadaire, mensuel, historique.
- Catégories : XP, victoires, bluffs réussis, richesse cumulée, badges, événements rares vus, succès débloqués.

## 9. Hall of Shame / Hall of Fame (fin de partie)
- À la fin de chaque partie, génération automatique de récompenses humoristiques par joueur (ex. "Pigeon Cosmique", "Ministre de l'Arnaque", "Banquier du Dimanche", "Bluff de l'Année", "Meilleur Acteur").
- Basé sur des métriques de la partie qui vient de se jouer (plus gros écart de bluff, achat le plus surpayé, plus gros retournement, etc. — cf. `08_AI.md` pour le calcul).
- Certaines distinctions récurrentes se transforment en badges permanents sur le profil.
- Affiché sur un écran dédié en fin de partie, partageable (image/lien).

## 10. Narrateur / réactions
- Un narrateur textuel (ou texte + voix synthétique en option future) commente les temps forts : grosses enchères, bluffs découverts, Kuhhandel audacieux.
- Plusieurs styles de narrateur activables par l'hôte (ex. commentateur sportif, documentaire animalier, western, présentateur télé) — cf. `08_AI.md`.
- Emotes/réactions rapides utilisables par les joueurs pendant la partie (chat enrichi, pas un chat libre non modéré en priorité v1).

## 11. Hors périmètre v1 (explicitement exclu, à ne pas développer avant la Phase finale)
- Application mobile native.
- Paiements / monétisation.
- Voix in-game (voice chat).
- Mode spectateur.
- Traductions multilingues (français uniquement en v1, structure i18n-ready mais pas remplie).
