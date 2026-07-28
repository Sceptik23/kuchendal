# PROMPT À COLLER DANS CLAUDE CODE

Copie-colle le bloc ci-dessous tel quel dans Claude Code, une fois les fichiers `/docs/*.md` placés à la racine de ton repo (dossier `docs/`).

---

Tu vas m'aider à développer **Kuchendal**, un jeu multijoueur d'enchères et de bluff en temps réel avec une couche complète de méta-progression (comptes, amis, XP, badges, titres, événements rares, Hall of Shame/Fame).

Toute la spécification du projet se trouve dans le dossier `/docs` à la racine de ce repo, composé de 10 documents :

- `00_VISION.md` — vision produit et definition of done
- `01_GDD_GAMEPLAY.md` — **règles officielles du jeu, document prioritaire en cas de conflit**
- `02_PRD_PRODUCT.md` — fonctionnalités produit (comptes, amis, lobby, progression)
- `03_ARCHITECTURE.md` — stack technique et architecture
- `04_DATABASE.md` — schéma de base de données
- `05_UI_UX.md` — design system et écrans
- `06_AUDIO_VFX.md` — sons et effets visuels
- `07_META_GAME.md` — badges, succès, titres, événements rares, XP
- `08_AI.md` — narrateur, bots, calcul des distinctions de fin de partie
- `09_IMPLEMENTATION_PLAN.md` — **plan de développement par phases, à suivre dans l'ordre**

**Avant toute chose, lis intégralement les 10 documents.** Ne commence aucun code sans les avoir lus. En cas de conflit apparent entre deux documents, `01_GDD_GAMEPLAY.md` fait toujours autorité sur les règles du jeu, et `09_IMPLEMENTATION_PLAN.md` fait autorité sur l'ordre de développement.

## Règles de travail impératives

1. **Suis les phases de `09_IMPLEMENTATION_PLAN.md` dans l'ordre strict.** Ne passe jamais à la phase suivante tant que les tests de la phase courante ne sont pas tous verts. Annonce-moi explicitement quand une phase est terminée et testée avant de commencer la suivante.
2. **Le moteur de règles (`packages/game-engine`) doit être 100% pur** : aucune dépendance réseau, aucune dépendance UI. Il doit être testable entièrement en isolation. C'est la pièce la plus critique du projet — sa fidélité aux règles décrites dans `01_GDD_GAMEPLAY.md` conditionne toute la crédibilité du jeu.
3. **Le serveur est l'unique source de vérité de l'état de jeu.** Le client ne fait jamais de calcul de règles, il propose des actions et affiche l'état reçu du serveur.
4. **Sécurité de l'information cachée** : les offres secrètes du Kuhhandel ne doivent jamais transiter, même dans le payload réseau brut, vers un client qui n'est pas censé les connaître avant le reveal officiel. Écris un test d'intégration explicite qui vérifie ce point dès la Phase 2.
5. **Toutes les valeurs de configuration ambiguës listées dans `01_GDD_GAMEPLAY.md` §5** (barème des espèces, gestion des égalités en Kuhhandel, condition de fin de partie, etc.) doivent être posées dans un fichier de configuration explicite et versionné, jamais codées en dur ni supposées implicitement. Si tu dois trancher une ambiguïté toi-même faute de précision, documente ton choix dans ce fichier de config avec un commentaire, et signale-le-moi dans ta réponse.
6. **Le système de badges/succès/titres/événements rares doit être data-driven** dès la Phase 6 (cf. `07_META_GAME.md` §1) : un moteur générique de conditions, jamais une suite de `if` dispersés dans le code. Ajouter un nouveau badge doit être possible en ajoutant une entrée de configuration, sans toucher au moteur.
7. **Pas d'appel LLM en production dans la boucle de jeu temps réel** (narrateur et bots sont déterministes/heuristiques en v1, cf. `08_AI.md` §5).
8. **Structure en monorepo** exactement comme décrite dans `03_ARCHITECTURE.md` §3 (`apps/web`, `apps/realtime-server`, `packages/game-engine`, `packages/shared-types`, `packages/ui`).
9. **Commits/PR par petites unités logiques**, une phase = plusieurs PR, jamais un commit géant qui mélange plusieurs phases.
10. **Écris les tests avant ou en même temps que le code** pour tout ce qui touche au moteur de règles (Phase 1) — pas de "je testerai plus tard".

## Ce que je veux que tu fasses maintenant

1. Confirme-moi que tu as lu et compris les 10 documents, et résume-moi en quelques lignes les points où tu as dû faire une hypothèse faute de précision explicite (en particulier les points listés dans `01_GDD_GAMEPLAY.md` §5).
2. Propose-moi la structure exacte de fichiers/dossiers pour la Phase 0, puis commence son implémentation.
3. À chaque fin de phase, donne-moi un résumé court : ce qui a été fait, ce qui est testé, ce qui reste en dette technique assumée, et attends ma validation avant de passer à la phase suivante.

Si à un moment une demande de ma part semble contredire un document existant dans `/docs`, dis-le-moi explicitement plutôt que de trancher silencieusement.
