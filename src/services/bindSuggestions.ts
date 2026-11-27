// Suggests CV files that probably belong to the same person, from their file names. Only a
// suggestion: the owner decides, because two different people can share a name.

/** How similar two cleaned-up names must be to suggest binding them (0..1) */
const SIMILARITY_THRESHOLD = 0.8;

// Words that say what kind of file it is rather than whose it is
const NOISE_WORDS = new Set([
  'cv', 'resume', 'résumé', 'curriculum', 'vitae', 'ansioluettelo', 'cover', 'letter', 'hakemus',
  'en', 'eng', 'english', 'fi', 'fin', 'finnish', 'suomi', 'suomeksi', 'sv', 'swe', 'svenska',
  'copy', 'kopio', 'final', 'new', 'uusi', 'updated', 'version', 'linkedin', 'profile', 'profiili',
]);

/** "Tommi_Hoikkala CV (2).pdf" -> "tommi hoikkala" */
export function personKey(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .toLowerCase()
    .replace(/[_\-.,()[\]{}+]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w) && !/^v?\d+$/.test(w))
    .join(' ');
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = temp;
    }
  }
  return prev[b.length];
}

/** 1 = identical names, 0 = nothing in common */
export function nameSimilarity(a: string, b: string): number {
  const x = personKey(a);
  const y = personKey(b);
  if (x.length < 3 || y.length < 3) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

/** Groups (2 or more) of the given file names that look like the same person */
export function suggestGroups(names: string[]): number[][] {
  // Union-find over pairs that are similar enough
  const parent = names.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (nameSimilarity(names[i], names[j]) >= SIMILARITY_THRESHOLD) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, number[]>();
  names.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()].filter((g) => g.length > 1);
}
