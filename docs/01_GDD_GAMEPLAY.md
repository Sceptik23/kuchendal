# 01 — GAME DESIGN DOCUMENT : RÈGLES DE JEU (KUHHANDEL)

> Ce document est la **source de vérité absolue** pour le moteur de règles. Toute ambiguïté dans le code doit être résolue en relisant ce document, pas en improvisant.

## 1. Composants du jeu

### 1.1 Cartes animaux
- 10 espèces, 4 exemplaires par espèce = 40 cartes animaux.
- Espèces suggérées (fidèles à l'esprit du jeu original, noms libres de droits à finaliser) : Cochon, Chèvre, Oie, Âne, Mouton, Chien, Chat, Cheval, Bœuf, Vache.
- Chaque espèce a une **valeur de famille complète** distincte (barème à définir dans une table de configuration `species.config.ts`, ex. valeurs croissantes de 100 à 1000 selon rareté perçue).
- Une famille incomplète ne vaut quasiment rien en fin de partie (valeur résiduelle symbolique ou nulle — à trancher en configuration, mais l'esprit du jeu est : "famille complète = beaucoup, animaux isolés = presque rien").

### 1.2 Cartes argent
- Valeurs : 0, 10, 50, 100, 200, 500.
- Les cartes "0" existent uniquement pour permettre de bluffer sur la composition de sa main (on peut montrer/poser une carte sans valeur).
- Chaque joueur démarre avec **90 points** (2 cartes 0, 4 cartes 10, 1 carte 50), distribués depuis une **banque partagée de 55 cartes**.
- Les cartes non distribuées à la mise en place restent dans la banque et peuvent être utilisées pour le change pendant la partie (quand un joueur manque de la coupure exacte pour une mise).

## 2. Mise en place
- 4 à 6 joueurs (le moteur doit accepter un minimum de 3 pour les tests, mais l'UX cible 4-6).
- Chaque joueur reçoit sa mise de départ en argent.
- Les 40 cartes animaux forment une pioche fermée, mélangée.
- Aucun joueur ne possède d'animal au départ.

## 3. Déroulement d'un tour
Le tour de jeu alterne entre deux mécaniques distinctes : **l'enchère** et **le Kuhhandel**. À son tour, le joueur actif choisit laquelle déclencher (s'il remplit les conditions du Kuhhandel).

### 3.1 Mécanique n°1 — L'enchère (vente aux enchères classique)
1. Le joueur actif retourne la première carte animal de la pioche (elle est visible de tous).
2. Un tour d'enchères s'ouvre : **tous les autres joueurs** (pas le joueur actif) peuvent enchérir à tour de rôle, dans l'ordre, en montant strictement par rapport à la meilleure offre en cours.
3. Un joueur peut passer à tout moment ; une fois passé, il ne peut plus revenir dans l'enchère pour cette carte.
4. L'enchère se termine quand un seul enchérisseur reste (tous les autres ont passé), ou que plus personne ne surenchérit.
5. **Règle spéciale du vendeur** : le joueur actif (celui qui a retourné la carte, qui ne peut pas enchérir lui-même) a le choix final :
   - **Vendre** : le meilleur enchérisseur paie le montant proposé au joueur actif et reçoit la carte animal.
   - **Garder** : le joueur actif paie lui-même le montant de la meilleure enchère au meilleur enchérisseur, et conserve la carte animal.
6. Cas particulier : si personne n'enchérit du tout, le joueur actif peut être contraint de garder la carte gratuitement (règle à confirmer/configurer — comportement par défaut : il la reçoit sans paiement si aucune offre n'a été faite).

### 3.2 Mécanique n°2 — Le Kuhhandel (l'échange/marchandage)
**Condition de déclenchement** : un joueur (l'initiateur) peut lancer un Kuhhandel avec un autre joueur (la cible) uniquement si les deux possèdent chacun **au moins un exemplaire de la même espèce** d'animal.

Déroulement :
1. L'initiateur choisit la cible et l'espèce concernée.
2. **Étape 1 — Offre secrète de l'initiateur** : l'initiateur compose une offre en cartes argent, face cachée (peut inclure des cartes "0" pour bluffer, ou même ne rien miser).
3. **Étape 2 — Réponse de la cible**, qui a deux options :
   - **Option A (Accepter)** : la cible accepte l'offre telle quelle, cède sa carte animal, et reçoit l'argent proposé par l'initiateur. Fin de l'échange.
   - **Option B (Contrer)** : la cible refuse et compose à son tour une offre secrète (même principe, cartes cachées).
4. Si contre-offre (option B) : les deux offres sont révélées simultanément.
   - Celui qui a misé le **montant le plus élevé** remporte la carte animal de l'autre.
   - **Chaque joueur conserve l'argent qu'il a lui-même misé** — seul l'animal change de main ; aucun argent n'est créé ni détruit lors d'un marchandage (contrairement à une enchère, où l'argent du gagnant va effectivement au vendeur).
   - En cas d'égalité stricte entre les deux montants : une nouvelle offre secrète est redemandée aux deux joueurs (nouvelle mise, on ne réutilise pas les mêmes cartes) ; si l'égalité persiste plusieurs fois, une règle de dégagement doit être configurée (ex. l'initiateur l'emporte par défaut à la 2e égalité, ou aucun échange n'a lieu — à trancher explicitement en configuration `kuhhandel.config.ts`, car les éditions du jeu physique varient sur ce point).
5. Un joueur ne peut pas refuser de participer à un Kuhhandel lancé contre lui s'il possède l'espèce concernée (le Kuhhandel est obligatoire une fois déclenché, seule la réponse — accepter ou contrer — est un choix).

6. **Marchandage spécial** : si les joueurs A et B possèdent chacun **deux** cartes de la même famille, le marchandage porte sur les **deux cartes à la fois** (le gagnant remporte les deux d'un coup). Si l'un des deux n'en possède qu'une, le marchandage ne porte que sur une seule carte.

### 3.3 L'âne d'or
Quand une carte "âne" est retournée pour être mise aux enchères, les enchères sont interrompues avant de commencer : chaque joueur (y compris le meneur) reçoit une carte argent supplémentaire — 50 la 1ère fois qu'un âne est retourné dans la partie, 100 la 2e, 200 la 3e, 500 la 4e (il y a exactement 4 ânes dans les 40 cartes animaux). L'âne est ensuite mis aux enchères normalement.

## 4. Fin de partie
- La partie se termine quand **toutes les familles (10 espèces) sont complètes** — pas nécessairement chez le même joueur, mais chacune des 10 espèces doit avoir ses 4 exemplaires réunis dans la main d'un seul joueur.
- **Phase de marchandage forcé** : dès que la pioche d'animaux est épuisée, les enchères s'arrêtent et le marchandage devient **obligatoire** à chaque tour. Un joueur qui, à ce stade, ne possède que des familles complètes (ou plus aucun animal) ne peut plus participer à un marchandage et passe son tour automatiquement.
- Chaque joueur totalise la valeur de ses familles **complètes** uniquement, puis **multiplie ce total par le nombre de familles complètes qu'il possède** (ex. 4 cochons + 4 chiens + 4 coqs = 820, ×3 familles = 2460 points).
- Les animaux isolés (famille incomplète) ne rapportent rien.
- Le joueur avec le score total le plus élevé gagne.
- **Note de design** : l'argent restant en main ne compte pas dans le score final.

## 5. Résumé des décisions de configuration figées
Ces points sont **désormais figés dans le moteur** :
- **Barème de valeur par espèce** : défini dans `species.config.ts`.
- **Mise de départ** : 90 points par joueur (2×0, 4×10, 1×50), banque partagée de 55 cartes.
- **Fin de partie** : quand toutes les 10 espèces sont complètes (pas avant).
- **Multiplicateur de score** : chaque joueur multiplie le total de ses familles complètes par le nombre de familles qu'il possède.
- **Comportement de marchandage obligatoire** : dès la pioche épuisée, tout échange devient obligatoire.

Les points ci-dessous restent configurables selon les éditions :
- Comportement exact en cas d'égalité lors d'un Kuhhandel (défini en `kuhhandel.config.ts`).
- Comportement si personne n'enchérit sur une carte animal.

## 6. Variantes envisageables (post-v1, hors périmètre initial)
- Mode "rapide" (moins de cartes, partie en 15 min).
- Mode équipes.
- Règles maison optionnelles activables par l'hôte du lobby (ex. autoriser le Kuhhandel dès le 2e animal identique visible même sans le posséder encore).

## 7. Machine à états du moteur de jeu (vue haut niveau)
```
LOBBY
  → GAME_START (distribution argent)
    → TURN_START (joueur actif désigné)
      → [choix] AUCTION_FLOW | KUHHANDEL_FLOW (si conditions remplies)
        AUCTION_FLOW: REVEAL_CARD → BIDDING_ROUND → SELLER_DECISION → RESOLVE
        KUHHANDEL_FLOW: SELECT_TARGET_AND_SPECIES → SECRET_OFFER_1 → RESPONSE(ACCEPT|COUNTER) → [SECRET_OFFER_2 → REVEAL] → RESOLVE
      → TURN_END → next player
    → (pioche épuisée) → SCORING → GAME_OVER → POST_GAME_REWARDS
```
Ce diagramme sert de base à l'implémentation de la state machine décrite dans `03_ARCHITECTURE.md`.
