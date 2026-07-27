# 07 — MÉTA-JEU : PROGRESSION, BADGES, SUCCÈS, TITRES, ÉVÉNEMENTS RARES

> Ambition long terme : 400+ badges, 100+ succès cachés, 300+ titres, 250+ événements rares.
> **Approche recommandée : traiter ce catalogue comme un backlog de contenu extensible, pas comme un bloquant du MVP.** La v1 doit livrer le *système* (moteur de déblocage générique, piloté par configuration data-driven) avec un catalogue restreint mais représentatif ; le contenu s'enrichit ensuite sans toucher au code.

## 1. Architecture data-driven (obligatoire)
Toutes les récompenses (badge, succès, titre, événement rare) doivent être définies comme des **entrées de configuration déclaratives** (fichiers JSON/TS de config, ou entrée en base — cf. `04_DATABASE.md`), avec :
```
{
  key: string,               // identifiant unique stable
  name: string,
  description: string,
  icon: string,
  rarity: "commun" | "rare" | "epique" | "legendaire" | "mythique" | "secret" | "ultra_secret",
  isSecret: boolean,
  condition: { type: string, params: {...} }  // référence à une règle de calcul, pas du code en dur dispersé
}
```
Un moteur unique évalue les conditions après chaque partie (et pour certaines, en temps réel pendant la partie) en lisant le `game_events_log` (cf. `04_DATABASE.md`). Ajouter un badge ne doit jamais nécessiter de modifier le moteur de jeu lui-même.

## 2. Système XP et niveaux
Sources d'XP (v1) :
- Fin de partie (participation) — petit montant fixe.
- Victoire — bonus.
- Premier bluff / premier Kuhhandel / première victoire (uniques, non répétables).
- Série de victoires consécutives (bonus croissant).
- Jouer avec un nouvel ami (première partie avec quelqu'un).
- Compléter une famille.
- Débloquer un badge/succès (XP bonus lié à la rareté).
- Découvrir un événement rare.

Courbe de niveau v1 : progression simple type `xp_requis(n) = 100 * n^1.4` (à ajuster en playtest) — le point important est que chaque niveau débloque un cosmétique visible (cadre, titre, emote), jamais un niveau "creux".

## 3. Catalogue de badges — v1 (échantillon représentatif, extensible)
| Nom | Condition | Rareté |
|---|---|---|
| Roi des Vaches | Compléter la famille Vache | Rare |
| Le Pigeon | Acheter un animal à ≥5x sa valeur estimée | Épique |
| Escroc certifié | Faire accepter une offre de Kuhhandel très défavorable à l'adversaire | Épique |
| Millionnaire | Terminer une partie avec un score élevé (seuil configurable) | Rare |
| Faillite | Terminer une partie sans argent | Commun |
| Poker Face | Réussir 10 bluffs d'affilée (sur plusieurs parties ou une seule, à définir) | Légendaire |
| Manipulateur | Faire monter une enchère de 3+ tours sans jamais l'emporter | Rare |
| Le Banquier | Encaisser un montant cumulé élevé sur une seule partie | Épique |
| Sniper | Compléter une famille au tout dernier tour possible | Épique |
| Démon des échanges | Gagner 3 Kuhhandel consécutifs (toutes parties confondues d'affilée) | Légendaire |
| Collectionneur | Compléter au moins 3 familles différentes dans sa carrière | Rare |
| Invaincu | 5 victoires consécutives | Légendaire |
| Maître du Bluff | ≥90% de réussite sur au moins 50 bluffs cumulés | Mythique |
| YOLO | Miser tout son argent sur une seule offre de Kuhhandel | Rare |
| Légende du Village | Débloquer tous les badges disponibles | Secret |

*(catalogue complet à étendre en continu post-v1 jusqu'à 400+, en réutilisant le même moteur de conditions)*

## 4. Succès cachés — v1 (échantillon)
Non visibles avant déblocage. Exemples :
- Perdre une partie alors qu'on était largement en tête au tour précédent.
- Gagner une partie sans remporter un seul Kuhhandel.
- Être le dernier joueur connecté après la fin d'une partie tardive.
- Refuser 5 offres de Kuhhandel d'affilée dans une même partie.

## 5. Titres — v1 (échantillon, extensible à 300+)
Le Banquier, Le Fermier, Le Tricheur, L'Arnaqueur, Le Charognard, Le Magnat, Le Pigeon Royal, L'Empereur des Vaches, Le Gourou du Bluff, Le Collectionneur, Le Roi du Kuhhandel, Le Maître des Enchères.
Affichage du titre actif : lobby, profil, classements, écran de fin de partie, chat.

## 6. Événements rares en partie — v1 (échantillon, extensible à 250+)
Chaque événement : probabilité très faible par tour, purement cosmétique (aucun impact sur les règles officielles du jeu, cf. `01_GDD_GAMEPLAY.md`).
- Une vache devient astronaute.
- Il pleut des billets (VFX uniquement).
- Le tracteur "abîme" visuellement une carte (cosmétique).
- Une poule surprise gagne une enchère (variante visuelle d'une carte classique).
- Jackpot de ferme (fanfare spéciale, sans effet sur le score).

## 7. Hall of Shame / Hall of Fame — calcul
Voir `08_AI.md` pour le détail du calcul des métriques par partie (plus gros bluff, plus grosse "arnaque", plus gros comeback, etc.) qui alimentent les distinctions humoristiques de fin de partie.

## 8. Classements
Catégories v1 : XP total, victoires, bluffs réussis, badges débloqués. Portées v1 : mondial + entre amis. (Hebdomadaire/mensuel/historique : extension post-v1, nécessite un job de recalcul périodique, cf. `04_DATABASE.md`.)

## 9. Priorisation recommandée pour le MVP
1. Moteur générique de conditions + XP/niveaux (obligatoire, fondation).
2. ~50 badges + ~30 succès (dont quelques cachés) + ~20 titres.
3. ~15-20 événements rares pour valider le pipeline technique.
4. Classements mondial + amis, 3-4 catégories.
5. Hall of Shame/Fame avec 8-10 distinctions de départ.
Le reste du catalogue s'ajoute en continu, sans refonte technique.
