import {
  Button,
  InfoStatusIcon,
  Input,
  PlayerAvatarBadge,
  PlayingCard,
  RARITIES,
  RarityFrame,
  Select,
  ToastNarrator,
} from '@kuhhandel/ui';
import type { NarratorStyle } from '@kuhhandel/shared-types';

const ANIMAL_ACCENTS = [
  'var(--kd-accent-green)',
  'var(--kd-accent-pink)',
  'var(--kd-accent-cyan)',
  'var(--kd-accent-yellow)',
  'var(--kd-accent-orange)',
];

// Real species + values from packages/game-engine/src/config/species.config.ts
// (not the design handoff's example numbers).
const ANIMALS: Array<{ species: string; slot: string; label: string; value: number }> = [
  { species: 'coq', slot: 'animal-Poule', label: 'Coq', value: 10 },
  { species: 'oie', slot: 'animal-Oie', label: 'Oie', value: 40 },
  { species: 'chat', slot: 'animal-Chat', label: 'Chat', value: 90 },
  { species: 'chien', slot: 'animal-Chien', label: 'Chien', value: 160 },
  { species: 'mouton', slot: 'animal-Mouton', label: 'Mouton', value: 250 },
  { species: 'chevre', slot: 'animal-Chèvre', label: 'Chèvre', value: 350 },
  { species: 'ane', slot: 'animal-Âne', label: 'Âne', value: 500 },
  { species: 'cochon', slot: 'animal-Cochon', label: 'Cochon', value: 650 },
  { species: 'vache', slot: 'animal-Vache', label: 'Vache', value: 800 },
  { species: 'cheval', slot: 'animal-Cheval', label: 'Cheval', value: 1000 },
];

// Real denominations from packages/game-engine/src/config/money.config.ts
const BILLS = [0, 10, 50, 100, 200, 500];

const NARRATOR_STYLES: NarratorStyle[] = ['sport', 'documentary', 'western', 'tv'];

export default function StyleGuidePage() {
  return (
    <main style={{ padding: 48, display: 'flex', flexDirection: 'column', gap: 48 }}>
      <section>
        <h2>Boutons</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="primary">Enchérir</Button>
          <Button variant="secondary">Passer</Button>
          <Button variant="danger">Vendre !</Button>
        </div>
      </section>

      <section>
        <h2>Cartes animaux</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 18,
          }}
        >
          {ANIMALS.map((a, i) => (
            <PlayingCard
              key={a.species}
              variant="animal"
              label={a.label}
              value={a.value}
              imageSlot={a.slot}
              accentColor={ANIMAL_ACCENTS[i % ANIMAL_ACCENTS.length] as string}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Billets</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 18,
          }}
        >
          {BILLS.map((value) => (
            <PlayingCard
              key={value}
              variant="money"
              label={`Billet ${value}`}
              value={value}
              imageSlot={`bill-${value}`}
              accentColor="var(--kd-accent-orange)"
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Rareté</h2>
        <div style={{ display: 'flex', gap: 14 }}>
          {RARITIES.map((r) => (
            <RarityFrame key={r} rarity={r} />
          ))}
        </div>
      </section>

      <section>
        <h2>Avatars joueur</h2>
        <div style={{ display: 'flex', gap: 20 }}>
          <PlayerAvatarBadge name="Jonathan" status="online" rarity="epique" />
          <PlayerAvatarBadge name="Alex" status="offline" />
        </div>
      </section>

      <section>
        <h2>Narrateur</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {NARRATOR_STYLES.map((style) => (
            <ToastNarrator
              key={style}
              narratorStyle={style}
              message="Et c'est une offre historique !"
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Champs</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Input placeholder="Pseudo" />
          <Select defaultValue="sport">
            <option value="sport">Commentateur sportif</option>
            <option value="documentary">Documentaire animalier</option>
          </Select>
        </div>
      </section>

      <section>
        <h2>Indicateurs d&apos;information</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <InfoStatusIcon status="known" label="Connu avec certitude" />
          <InfoStatusIcon status="partial" label="Partiellement connu" />
        </div>
      </section>
    </main>
  );
}
