import type { NarratorTemplateCatalog } from "../types.js";

/**
 * v1 template catalog (08_AI.md §1). Referenced by key
 * (`narrator.<style>.<eventKey>`) from the calling code/docs, but stored
 * here as a plain nested object — adding a phrase never requires touching
 * the selection engine.
 */
export const NARRATOR_TEMPLATES: NarratorTemplateCatalog = {
  sport: {
    bigBid: [
      { weight: 2, text: "Quelle enchère ! {player} monte à {amount} sur le/la {species} !" },
      { weight: 1, text: "{player} met le paquet : {amount} pour ce/cette {species} !" },
    ],
    bluffRevealed: [
      { weight: 2, text: "Bluff magistral de {player}, qui l'emporte en misant moins que {opponent} !" },
      { weight: 1, text: "{player} a lu {opponent} comme un livre ouvert — bluff réussi !" },
    ],
    boldKuhhandel: [
      { weight: 2, text: "{player} joue son va-tout dans ce Kuhhandel !" },
      { weight: 1, text: "Prise de risque énorme de {player} face à {opponent} !" },
    ],
    comeback: [
      { weight: 2, text: "Retournement de situation : {player} reprend la tête !" },
      { weight: 1, text: "Personne ne l'avait vu venir : {player} passe devant !" },
    ],
  },
  documentary: {
    bigBid: [
      { weight: 2, text: "Observez {player}, qui investit {amount} pour ce/cette {species}." },
      { weight: 1, text: "Un comportement d'enchérisseur agressif : {amount} proposés par {player}." },
    ],
    bluffRevealed: [
      { weight: 2, text: "Ici, {player} démontre une stratégie de dissimulation efficace face à {opponent}." },
      { weight: 1, text: "Une ruse discrète permet à {player} de l'emporter à moindre coût." },
    ],
    boldKuhhandel: [
      { weight: 2, text: "{player} engage la quasi-totalité de ses ressources dans cet échange." },
      { weight: 1, text: "Un pari risqué de {player}, observable dans la nature comme dans ce Kuhhandel." },
    ],
    comeback: [
      { weight: 2, text: "La hiérarchie du groupe se réorganise : {player} prend l'avantage." },
      { weight: 1, text: "Un basculement inattendu place {player} en tête." },
    ],
  },
  western: {
    bigBid: [
      { weight: 2, text: "{player} pose {amount} sur la table pour ce/cette {species}, partenaire." },
      { weight: 1, text: "Grosse mise de {player} : {amount}, rien que ça." },
    ],
    bluffRevealed: [
      { weight: 2, text: "{player} avait un jeu de dupes, et {opponent} est tombé dans le panneau." },
      { weight: 1, text: "Coup de bluff bien joué par {player}, {opponent} n'a rien vu venir." },
    ],
    boldKuhhandel: [
      { weight: 2, text: "{player} joue son va-tout dans ce duel avec {opponent}." },
      { weight: 1, text: "Tout ou rien pour {player} dans ce Kuhhandel." },
    ],
    comeback: [
      { weight: 2, text: "{player} revient de nulle part et prend la tête du convoi." },
      { weight: 1, text: "Retournement inattendu : {player} passe devant tout le monde." },
    ],
  },
  tv: {
    bigBid: [
      { weight: 2, text: "Et voilà {player} qui annonce {amount} pour ce/cette {species} !" },
      { weight: 1, text: "{amount} ! {player} frappe fort sur ce lot." },
    ],
    bluffRevealed: [
      { weight: 2, text: "Ce qu'on ne vous avait pas dit : {player} a bluffé {opponent} avec brio !" },
      { weight: 1, text: "Rebondissement : {player} l'emporte en ayant misé bien moins que {opponent} !" },
    ],
    boldKuhhandel: [
      { weight: 2, text: "{player} tente le tout pour le tout face à {opponent} !" },
      { weight: 1, text: "Quel courage : {player} engage presque toute sa cagnotte !" },
    ],
    comeback: [
      { weight: 2, text: "Incroyable retournement de situation pour {player} !" },
      { weight: 1, text: "{player} reprend les commandes de la partie !" },
    ],
  },
};
