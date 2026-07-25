// Renders a get_student_skill_report tool result (from the coach chat) as a compact, read-only
// data card. Shows only the numbers the tool returned — the chat prose is grounded in these.
interface SkillRow {
  slug: string;
  name: string;
  accuracy?: number;
  attempted?: number;
  sufficientEvidence?: boolean;
  slowWrong?: number | null;
}

function pct(x: number | undefined): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`;
}

function barColor(acc: number | undefined, sufficient: boolean | undefined): string {
  if (!sufficient) return '#9aa4b2';
  if (acc == null) return '#9aa4b2';
  if (acc < 0.5) return '#d64550';
  if (acc < 0.7) return '#e0902a';
  return '#2e9e5b';
}

export function SkillReportCard({ report }: { report: any }) {
  const skills: SkillRow[] = Array.isArray(report?.skills) ? report.skills : [];
  const subject = report?.subject;

  return (
    <div className="max-w-xl rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
        <span className="text-[10px] font-bold tracking-wider uppercase text-brand-blue bg-blue-50 px-2 py-0.5 rounded">
          Skill report
        </span>
        {subject && <span className="text-xs text-gray-500 capitalize">{subject}</span>}
      </div>
      {skills.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-500">No skills with data yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-500">
              <th className="text-left font-semibold px-4 py-2">Skill</th>
              <th className="text-left font-semibold px-4 py-2">Accuracy</th>
              <th className="text-left font-semibold px-4 py-2">n</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.slug} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-14 h-1.5 rounded bg-gray-100 overflow-hidden align-middle">
                      <span
                        className="block h-full rounded"
                        style={{ width: `${Math.round((s.accuracy ?? 0) * 100)}%`, background: barColor(s.accuracy, s.sufficientEvidence) }}
                      />
                    </span>
                    {pct(s.accuracy)}
                  </span>
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {s.attempted ?? 0}
                  {!s.sufficientEvidence && (
                    <span className="ml-2 text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      not enough data
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
