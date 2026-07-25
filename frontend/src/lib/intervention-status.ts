// Shared presentation for an intervention's recomputed outcome status (spec §6.3's three values),
// used by the Improvement Journey cards and the workspace Active Interventions strip.

export const INTERVENTION_STATUS_LABEL: Record<string, string> = {
  improving: 'Improving',
  'not-yet-improving': 'Not yet improving',
  'insufficient-evidence': 'Not enough data yet',
};

export function interventionStatusClasses(status: string): string {
  if (status === 'improving') return 'bg-green-50 text-green-700';
  if (status === 'not-yet-improving') return 'bg-amber-50 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}
