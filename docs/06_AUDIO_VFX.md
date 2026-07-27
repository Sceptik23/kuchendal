# 06 — AUDIO & VFX

## 1. Principes
- Le son doit renforcer la lecture de l'information : un son distinct pour "enchère montée", "offre secrète soumise", "reveal de Kuhhandel", "victoire de famille", "badge débloqué".
- Volumes/mute contrôlables individuellement (musique, effets, voix narrateur) dans les paramètres — ne jamais imposer un son fort par défaut au lancement.

## 2. Bibliothèque de sons v1 (MVP)
| Événement | Son |
|---|---|
| Révélation de carte animal | "flip" carte |
| Enchère surenchérie | "cha-ching" léger, monte en intensité avec le montant |
| Décision du vendeur (garder/vendre) | sting distinct selon le choix |
| Offre secrète soumise | son feutré, discret (ne doit rien révéler par le son lui-même — attention à ne pas encoder d'info dans la durée/intensité du son) |
| Reveal de Kuhhandel | roulement de tambour court + sting de résolution |
| Famille complétée | fanfare courte |
| Badge / succès débloqué | jingle de récompense |
| Événement rare déclenché | thème sonore dédié, identifiable (cf. `07_META_GAME.md`) |

**Point de vigilance sécurité de l'information** : aucun son ne doit permettre de deviner indirectement le contenu d'une offre secrète avant le reveal officiel (ex. ne pas faire varier la durée du son "offre soumise" selon le montant réel misé).

## 3. VFX v1
- Flip 3D léger sur les cartes.
- Particules discrètes sur gain d'argent/carte.
- Halo/glow sur le joueur qui vient de remporter un Kuhhandel.
- Effet "spotlight" bref sur le narrateur quand il commente un moment fort.

## 4. Événements rares — habillage
Chaque événement rare (cf. `07_META_GAME.md` pour le catalogue) doit définir, dans sa fiche de configuration :
- une courte animation dédiée,
- un son signature,
- une ligne de texte du narrateur associée,
- le badge/statistique qu'il incrémente le cas échéant.

## 5. Narrateur vocal (optionnel, post-v1)
- v1 : texte uniquement (bulle/toast), pas de synthèse vocale, pour limiter la complexité initiale.
- Une évolution possible : intégration TTS (à évaluer séparément, hors périmètre MVP) une fois le système de texte du narrateur stabilisé (cf. `08_AI.md`).
