# Éléments de design à fournir

> Inventaire de tout ce qui doit être conçu visuellement pour habiller le
> jeu (actuellement une UI fonctionnelle mais non stylée). Basé sur
> `05_UI_UX.md` (direction artistique) et sur ce qui existe déjà dans le
> code (Phases 0-9). À remplir au fur et à mesure ; rien ici n'est codé
> tant que les assets/décisions ne sont pas fournis.

## 0. Direction artistique générale (à valider en premier)
- [x] Palette de couleurs définitive (fond quasi-noir + accents fluo —
      voir `packages/ui/src/tokens.css` ; remplace la palette terreuse
      initialement prévue dans `05_UI_UX.md` §1)
- [x] Typographie (titres + texte courant)
- [x] Ton visuel de référence (3-5 exemples/inspirations : cartoon sans être
      enfantin, un peu d'humour/clin d'œil)
- [ ] Logo / nom affiché ("Kuchendal")
- [ ] Favicon

## 1. Cartes animaux (10 espèces × 4 exemplaires)
Pour chaque espèce ci-dessous : une illustration recto (face visible) et
un dos de carte commun à toutes.
- [x] Cochon (valeur famille 100)
- [x] Oie (200)
- [x] Mouton (300)
- [x] Chèvre (400)
- [x] Âne (500)
- [x] Chien (650)
- [x] Chat (800)
- [x] Cheval (1000)
- [ ] Bœuf (1200)
- [x] Vache (1500)
- [ ] Dos de carte animal (commun)
- [ ] États visuels : face visible, face cachée, sélectionnée, en cours
      d'enchère (léger effet de surbrillance/tension)

## 2. Cartes argent (6 valeurs)
- [x] Billet 0 (bluff)
- [x] Billet 10
- [x] Billet 50
- [x] Billet 100
- [x] Billet 200
- [x] Billet 500
- [ ] Dos de carte argent (pour les offres secrètes cachées)

## 3. Composants d'interface (design system)
D'après `05_UI_UX.md` §5 — chaque composant existe déjà en HTML brut, à
habiller :
- [ ] `PlayingCard` (animal/argent) — déjà listé en §1-2 ci-dessus
- [x] `PlayerAvatarBadge` (avatar + statut en ligne/absent + titre actif)
- [ ] `BidTicker` (historique d'enchère en direct, montant qui monte)
- [ ] `SecretOfferTray` (plateau de composition d'offre secrète Kuhhandel)
- [x] `ToastNarrator` (bulle de commentaire du narrateur)
- [ ] `RewardModal` (déblocage badge/succès/titre, avec animation d'entrée)
- [ ] `HallOfShameCard` (carte de distinction humoristique de fin de partie)
- [x] Boutons (primaire/secondaire/danger), inputs, selects — style de base
- [x] Icônes d'état d'information : "connu avec certitude" (✅ actuel),
      "partiellement connu" (🔒 actuel), à remplacer par de vraies icônes
      cohérentes visuellement (cf. `05_UI_UX.md` §4)

## 4. Avatars joueur
- [ ] Set d'avatars prédéfinis (combien ? ex. 12-20 pour commencer)
- [ ] Emplacement pour avatar uploadé par l'utilisateur (juste le cadre/
      style d'affichage, pas l'asset lui-même)
- [ ] Cadres de profil déblocables par niveau (cf. §7 ci-dessous)

## 5. Écrans complets (`05_UI_UX.md` §2)
Maquettes ou direction visuelle pour chacun (l'existant est fonctionnel,
non stylé) :
- [ ] Accueil / Auth
- [ ] Hub joueur (profil résumé, amis en ligne, créer/rejoindre)
- [ ] Lobby (liste joueurs, réglages hôte, invite/QR code)
- [ ] Table de jeu (vue desktop "table ronde")
- [ ] Table de jeu (vue mobile, liste verticale + zone perso fixe)
- [ ] Résolution d'enchère (overlay historique + décision vendeur)
- [ ] Résolution de Kuhhandel (zone de mise secrète, compte à rebours reveal)
- [ ] Fin de partie / Hall of Shame-Fame
- [ ] Profil public (stats, badges, titres, historique)
- [ ] Classements
- [ ] Paramètres de compte

## 6. Narrateur — identité visuelle par style (4 styles existants)
Pour chacun : une icône/avatar de narrateur + un style de bulle de texte
distinct (couleur/police/cadre) :
- [ ] Commentateur sportif
- [ ] Documentaire animalier
- [ ] Western
- [ ] Présentateur télé

## 7. Badges (15 déjà définis en base — icône par badge)
- [ ] Roi des Vaches
- [ ] Le Pigeon
- [ ] Escroc certifié
- [ ] Millionnaire
- [ ] Faillite
- [ ] Poker Face
- [ ] Manipulateur
- [ ] Le Banquier
- [ ] Sniper
- [ ] Démon des échanges
- [ ] Collectionneur
- [ ] Invaincu
- [ ] Maître du Bluff
- [ ] YOLO
- [ ] Légende du Village (badge secret)
- [x] Un style de cadre par rareté (commun/rare/épique/légendaire/
      mythique/secret/ultra-secret) — 7 variantes visuelles (implémenté
      dans `packages/ui/src/RarityFrame/` — reste à appliquer aux icônes
      de badges elles-mêmes une fois celles-ci fournies)

## 8. Succès cachés (4 définis — icône ou juste texte stylé au choix)
- [ ] Grand retournement manqué
- [ ] Victoire sans marchandage
- [ ] Dernier à la ferme
- [ ] Méfiance totale

## 9. Titres (12 définis — juste un style d'affichage, pas d'icône dédiée a priori)
Le Banquier, Le Fermier, Le Tricheur, L'Arnaqueur, Le Charognard, Le
Magnat, Le Pigeon Royal, L'Empereur des Vaches, Le Gourou du Bluff, Le
Collectionneur, Le Roi du Kuhhandel, Le Maître des Enchères.
- [ ] Style d'affichage du titre actif (lobby, profil, classements, fin
      de partie, chat)

## 10. Hall of Shame / Hall of Fame — 5 distinctions de fin de partie
- [ ] Bluff de l'année
- [ ] Ministre de l'arnaque
- [ ] Pigeon cosmique
- [ ] Banquier du dimanche
- [ ] Meilleur acteur
- [ ] Un visuel/cadre "carte de distinction" commun (cf. `HallOfShameCard`)

## 11. Événements rares (18 définis — animation + son chacun)
Pour chacun : une courte animation (VFX) et un son signature (voir clé
`vfx`/`sound` dans `packages/rare-events-engine/src/config/rareEvents.config.ts`) :
- [ ] Vache astronaute (`confetti-launch` / `whoosh`)
- [ ] Pluie de billets (`money-rain` / `cha-ching-soft`)
- [ ] Tracteur farceur (`mud-splash` / `engine-sputter`)
- [ ] Poule surprise (`feather-burst` / `cluck`)
- [ ] Jackpot de ferme (`gold-sparkle` / `fanfare-short`)
- [ ] Éclipse sur la ferme (`screen-dim-pulse` / `eerie-hum`)
- [ ] Arc-en-ciel (`rainbow-arc` / `chime-glimmer`)
- [ ] OVNI en approche (`ufo-flyby` / `sci-fi-blip`)
- [ ] Canard déguisé (`disguise-wobble` / `quack-muffled`)
- [ ] Tempête de plumes (`feather-storm` / `wind-gust`)
- [ ] Fanfare villageoise (`confetti-launch` / `brass-fanfare`)
- [ ] Cochon danseur (`dance-wiggle` / `tap-shoes`)
- [ ] Vent de folie (`wind-swirl` / `wind-gust`)
- [ ] Pleine lune sur les meules de foin (`moonlight-glow` / `eerie-hum`)
- [ ] Le sosie du fermier (`double-vision` / `comedic-horn`)
- [ ] Mouton zen (`zen-shimmer` / `chime-glimmer`)
- [ ] Nouveau record du village (`gold-sparkle` / `fanfare-short`)
- [ ] Étoile filante (`shooting-star` / `chime-glimmer`)

## 12. Autres sons (hors événements rares, `06_AUDIO_VFX.md` §2)
- [ ] Révélation de carte animal ("flip")
- [ ] Enchère surenchérie ("cha-ching", intensité croissante avec le montant)
- [ ] Décision du vendeur (garder / vendre — 2 sons distincts)
- [ ] Offre secrète soumise (son feutré, discret — ne doit rien révéler)
- [ ] Reveal de Kuhhandel (roulement de tambour + sting de résolution)
- [ ] Famille complétée (fanfare courte)
- [ ] Badge / succès débloqué (jingle de récompense)

## 13. Animations clés (`05_UI_UX.md` §7, Framer Motion prévu)
Pas des assets à fournir mais des comportements à valider/décrire :
- [ ] Flip 3D d'une carte animal
- [ ] Montée d'enchère (montant qui s'incrémente, tension visuelle au-delà
      d'un seuil)
- [ ] Reveal simultané des offres secrètes (compte à rebours + suspense)
- [ ] Déblocage badge/titre/niveau (confetti léger)
- [ ] Apparition d'un événement rare (spotlight bref)

## 14. Cosmétiques débloquables par niveau (`07_META_GAME.md` §2)
- [ ] Cadres de profil (un par palier de niveau, quantité à définir)
- [ ] Emotes (réactions rapides en partie)
- [ ] Effets visuels de carte (skin appliqué aux cartes à haut niveau)
- [ ] Icônes de niveau/palier

---

**Comment procéder** : fournis les éléments dans l'ordre qui te convient
(je recommande §0 direction artistique d'abord, puis §1-2 cartes puisque
ce sont les éléments vus en permanence, puis le reste). Pour chaque
élément, un fichier image (SVG/PNG) ou une description suffisamment
précise pour que je le génère/intègre fonctionne. Je peux aussi proposer
des pistes de style si tu préfères partir de suggestions plutôt que d'une
page blanche.
