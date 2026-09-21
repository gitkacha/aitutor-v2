// W-140: tutor-authored topic briefs spliced into the math worksheet generation prompt
// (docs/targetted, WIP). Pure data + string building — no model calls, no DB — so the whole
// thing is unit-testable in isolation and easy to A/B against the baseline prompt.

export interface TopicBrief {
  title: string;
  /** Named mistakes — each must be reachable as a wrong option (drives the DISTRACTOR_RULE). */
  commonErrors: string[];
  /**
   * Distribution requirements, authored as PER-~10-QUESTIONS proportional emphasis (never absolute
   * whole-worksheet counts): generation runs in independent batches of <=10 that cannot coordinate
   * totals, so ratios are the only thing each batch can honour.
   */
  questionMix: string[];
}

const GRAPH_SCALE_BRIEF: TopicBrief = {
  title: 'Graph and scale reading',
  commonErrors: [
    'assuming each gridline is worth 1 unit',
    'reading the wrong points for the range the question actually asks about',
    'giving a single plotted value when the question asks for an average or a total',
    'counting gridlines instead of the gaps between them',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 3 must use a non-whole-number axis/scale interval (e.g. 1.1, 2.5 or 30) so the student has to work out the scale.',
    'At least 2 in every 10 must hang several sub-questions off the SAME figure (reuse one graph or table across a small cluster).',
    'At least 2 in every 10 must ask for a range, mean or total rather than a single reading.',
  ],
};

const TIME_BRIEF: TopicBrief = {
  title: 'Time zones and elapsed time',
  commonErrors: [
    'adding hours when the situation requires subtracting (or vice versa)',
    'stopping after the first conversion in a two-hop problem',
    'flipping am and pm',
    'minute-arithmetic slips when crossing an hour boundary',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 3 must be two-hop problems (city A to city B to city C).',
    'At least 2 in every 10 must cross midnight into the next day.',
    'At least 2 in every 10 must use a half-hour offset such as +11:15 or +9:30.',
  ],
};

const SHAPE_BRIEF: TopicBrief = {
  title: 'Composite and rearranged shapes',
  commonErrors: [
    'forgetting to account for unlabelled sides',
    'mixing up cm² and m² (missing the unit conversion)',
    'assuming the perimeter is unchanged when the pieces are rearranged',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 3 must break a shape apart and rebuild it, then ask for the NEW perimeter.',
    'At least 2 in every 10 must be set on a grid with a stated scale per square.',
    'At least 2 in every 10 must require a unit conversion in the final answer.',
  ],
};

const FRACTIONS_BRIEF: TopicBrief = {
  title: 'Fractions of a remainder, ratio and ordering',
  commonErrors: [
    'taking the second fraction of the ORIGINAL amount instead of the remainder',
    'failing to work backwards from a final amount to the starting amount',
    'misordering a mix of fractions, decimals and percentages',
  ],
  questionMix: [
    'In roughly every 10 questions, at least 4 must be working-backwards problems (given the final amount, find the start).',
    'At least 3 in every 10 must be "arrange these and name the middle one" questions mixing fractions, decimals and percentages.',
    'At least 3 in every 10 must be ratio-scaling problems with a non-whole-number share.',
  ],
};

// Two topics can share one brief (Brief 1 covers both graphs and protractor scales); the shared
// object identity lets buildTopicBriefSection de-duplicate when both are selected.
export const TOPIC_BRIEFS: Record<string, TopicBrief> = {
  'data-interpretation': GRAPH_SCALE_BRIEF,
  'protractor-skills': GRAPH_SCALE_BRIEF,
  'time-zones': TIME_BRIEF,
  time: TIME_BRIEF,
  perimeter: SHAPE_BRIEF,
  fractions: FRACTIONS_BRIEF,
};

export const DISTRACTOR_RULE = `DISTRACTOR RULE — the most important instruction. Every question's four wrong options must be the answer a student would actually get from a real, specific mistake — never a random or filler number. Draw those mistakes from the "Common errors" listed for the question's topic above. At least two of the four wrong options in every question must be reachable by a plausible slip. In the explanation, name the mistake behind at least one wrong option, e.g. "If you chose B, you counted the gridlines instead of the gaps."`;

export const FIGURES_RULE = `FIGURES — DRAW THEM ACCURATELY. Any graph, scale, number line, measuring cylinder, protractor or shape must be specified precisely enough that a tutor could redraw it by hand: give exact axis labels, the value of every gridline, the number of unlabelled intervals between labelled points, and the coordinates or side lengths of every plotted point or vertex. For the AXIS or SCALE intervals of graphs, number lines and measuring scales, deliberately avoid an interval of 1 — use an interval like 1.1, 2.5 or 30 so the student must work out the scale rather than assume each gridline is 1. (This applies to axis/scale intervals only; pie-chart slices and protractor angles stay clean and eye-readable as required elsewhere in this prompt.)`;

// W-146: only for a worksheet that is EXCLUSIVELY Data Interpretation. The topic spans several
// figure sub-types, and left alone the model leans on one (usually pie charts); this spreads the
// questions across all four. Phrased per-batch (rotate through the sub-types) because generation
// runs in independent <=10 batches that cannot coordinate whole-worksheet totals.
export const DATA_INTERP_SUBTYPE_BALANCE = `DATA INTERPRETATION SUB-TYPE BALANCE. This worksheet is entirely Data Interpretation, so spread the questions roughly EQUALLY across the four figure sub-types — pie charts, bar graphs, line graphs, and tables — aiming for about a quarter of the whole worksheet on each. Do NOT lean on one sub-type: within every batch, rotate through pie / bar / line / table so no single kind dominates. (Use the matching stimulus figure — pie-chart, bar-chart, line-chart or table — for each.)`;

/**
 * Assembles the per-topic brief blocks (de-duplicated by shared brief identity) followed by the two
 * shared rule blocks, each once. Returns '' when none of the selected topics is briefed, so the
 * caller can keep the baseline prompt byte-for-byte.
 */
export function buildTopicBriefSection(topicSlugs: string[]): string {
  const briefs: TopicBrief[] = [];
  const seen = new Set<TopicBrief>();
  for (const slug of topicSlugs) {
    const brief = TOPIC_BRIEFS[slug];
    if (brief && !seen.has(brief)) {
      seen.add(brief);
      briefs.push(brief);
    }
  }
  if (briefs.length === 0) return '';

  const blocks = briefs
    .map(
      (b) =>
        `TOPIC BRIEF — ${b.title}\nCommon errors (use these to build the wrong options):\n${b.commonErrors
          .map((e) => `- ${e}`)
          .join('\n')}\nQuestion mix for this topic:\n${b.questionMix.map((m) => `- ${m}`).join('\n')}`,
    )
    .join('\n\n');

  // W-146: sub-type balance applies only when Data Interpretation is the SOLE selected topic.
  const singleDataInterp = topicSlugs.length === 1 && topicSlugs[0] === 'data-interpretation';
  const subtypeBalance = singleDataInterp ? `\n\n${DATA_INTERP_SUBTYPE_BALANCE}` : '';

  return `${blocks}\n\n${DISTRACTOR_RULE}\n\n${FIGURES_RULE}${subtypeBalance}\n\nVary the names, contexts and objects across questions so repeat worksheets don't feel recycled.`;
}
