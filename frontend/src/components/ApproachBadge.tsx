// W-118: a small chip showing which A/B generation prompt produced a coaching lesson. "Standard" (A)
// is the default and shown muted; "Tactical" (B) is highlighted so experiment lessons stand out in
// the admin lists. Absent/unknown approach is treated as Standard (pre-W-118 rows).
export default function ApproachBadge({ approach }: { approach?: 'standard' | 'tactical' }) {
  if (approach === 'tactical') {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Tactical</span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Standard</span>
  );
}
