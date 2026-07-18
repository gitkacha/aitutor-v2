// Saved math worksheet titles use topic names (L10) — slugs are URL identifiers, not labels.
export function mathWorksheetTitle(
  selectedSlugs: string[],
  topics: Array<{ slug: string; name: string }>
): string {
  if (selectedSlugs.length === 0) return 'Worksheet: All Topics';
  const names = selectedSlugs.map((slug) => topics.find((t) => t.slug === slug)?.name ?? slug);
  return `Worksheet: ${names.join(', ')}`;
}
