export interface StatDefinition {
  id: string;
  label: string;
  description: string;
  base: number;
  min: number;
  max: number;
}

export const primaryStats: StatDefinition[] = [
  {
    id: 'STR',
    label: 'Strength',
    description: 'Defines melee damage, carry weight and weapon handling.',
    base: 5,
    min: 1,
    max: 10,
  },
  {
    id: 'PER',
    label: 'Perception',
    description: 'Influences sequence, ranged accuracy and awareness radius.',
    base: 5,
    min: 1,
    max: 10,
  },
  {
    id: 'END',
    label: 'Endurance',
    description: 'Affects hit points, poison resistance and survivability.',
    base: 5,
    min: 1,
    max: 10,
  },
  {
    id: 'CHA',
    label: 'Charisma',
    description: 'Used for barter prices and companion control limits.',
    base: 5,
    min: 1,
    max: 10,
  },
  {
    id: 'INT',
    label: 'Intelligence',
    description: 'Determines skill points per level and crafting efficiency.',
    base: 5,
    min: 1,
    max: 10,
  },
  {
    id: 'AGI',
    label: 'Agility',
    description: 'Determines action points and combat speed.',
    base: 5,
    min: 1,
    max: 10,
  },
  {
    id: 'LCK',
    label: 'Luck',
    description: 'Affects critical chance and gambling outcomes.',
    base: 5,
    min: 1,
    max: 10,
  },
];

export const derivedStats: StatDefinition[] = [
  {
    id: 'HP',
    label: 'Hit Points',
    description: 'Total health points available before a critter is knocked out.',
    base: 30,
    min: 1,
    max: 999,
  },
  {
    id: 'AP',
    label: 'Action Points',
    description: 'Points used to perform actions during combat turns.',
    base: 8,
    min: 1,
    max: 20,
  },
  {
    id: 'AC',
    label: 'Armor Class',
    description: 'Passive defense bonus representing dodge ability.',
    base: 0,
    min: -20,
    max: 100,
  },
  {
    id: 'SEQ',
    label: 'Sequence',
    description: 'Determines combat turn order.',
    base: 10,
    min: 1,
    max: 50,
  },
  {
    id: 'CRIT',
    label: 'Critical Chance',
    description: 'Percentage chance for critical hits.',
    base: 5,
    min: 0,
    max: 100,
  },
];
