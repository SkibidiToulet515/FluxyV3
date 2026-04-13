/** Must match Client/src/config/subjects.js SUBJECT_KEYS */
export const VALID_SUBJECTS = [
  'Math',
  'History',
  'Chemistry',
  'Social Studies',
  'English',
  'Science',
];

export function normalizeSubject(value) {
  if (!value || typeof value !== 'string') return null;
  const t = value.trim();
  return VALID_SUBJECTS.includes(t) ? t : null;
}

/**
 * Infer academic subject from title + category when `subject` is not set in DB.
 */
export function inferSubject(nameLower, category) {
  const cat = (category || '').toLowerCase();

  if (
    /math|2048|number|sudoku|calc|logic|puzzle|count|digit|equation/.test(nameLower)
  ) {
    return 'Math';
  }
  if (/chem|molecule|atom|periodic|lab|reaction|acid/.test(nameLower)) {
    return 'Chemistry';
  }
  if (
    /history|ancient|empire|medieval|rome|war|king|battle|civilization|castle|knight|pirate|temple/.test(
      nameLower,
    )
  ) {
    return 'History';
  }
  if (
    /word|spell|letter|type|grammar|book|read|english|crossword|scrabble|vocab/.test(
      nameLower,
    )
  ) {
    return 'English';
  }
  if (
    /city|traffic|world|country|geo|nation|president|government|society|culture/.test(
      nameLower,
    )
  ) {
    return 'Social Studies';
  }
  if (
    /space|planet|star|galaxy|physics|science|nature|animal|dino|ocean|forest|microscope|evolution/.test(
      nameLower,
    )
  ) {
    return 'Science';
  }

  if (cat === 'puzzle') return 'Math';
  if (cat === 'sports' || cat === '2 player') return 'Social Studies';
  if (cat === 'racing' || cat === 'platformer' || cat === 'action') return 'Science';

  return 'Science';
}
