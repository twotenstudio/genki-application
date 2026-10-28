/** The page sections, in order. The page headings and the map's islands both read from this. */
export const sections = [
  { id: 'built', number: '01', title: "What I've built" },
  { id: 'bet', number: '02', title: 'An architectural bet I lived with' },
  { id: 'agents', number: '03', title: 'How I work with AI agents' },
  { id: 'ship-safely', number: '04', title: 'Letting non-engineers ship safely' },
  { id: 'links', number: '05', title: 'Links' },
] as const;

export type SectionId = (typeof sections)[number]['id'];
export type SectionInfo = (typeof sections)[number];

export function section(id: SectionId): SectionInfo {
  const found = sections.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown section: ${id}`);
  return found;
}
