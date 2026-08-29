import type { PrismaClient } from '@prisma/client';

// Thinking Skills (Phase 1, W-91): the 7 fixed sections, plus exemplar bank questions transcribed
// from ThinkingSkills-Test7.pdf / Test8.pdf. Exemplars are the difficulty & format anchors the
// generator is shown ("produce questions at or above the difficulty of these"), exactly as
// Mathematics anchors on each topic's hardest reference question. All questions are 4-option (A–D),
// matching the NSW Thinking Skills format in the PDFs. The identifying-similarity exemplars are
// authored at the same difficulty/format (the sampled PDF pages did not contain a clean example of
// that type); every other section's exemplars are transcribed from the PDFs.

export interface TSTopicSeed {
  slug: string;
  name: string;
  description: string;
}

export interface TSQuestionSeed {
  topicSlug: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  stimulus?: string; // JSON StimulusSpec, or omitted
}

export const THINKING_SKILLS_TOPICS: TSTopicSeed[] = [
  { slug: 'finding-procedures', name: 'Finding Procedures', description: 'Work out a method or sequence of steps to reach an answer, often from a table, rule or set of quantities.' },
  { slug: 'evaluating-reasoning-errors', name: 'Evaluating Reasoning Errors', description: 'Identify the flaw or unjustified assumption in someone\'s argument or conclusion.' },
  { slug: 'logical-analysis', name: 'Logical Analysis', description: 'Deduce what must be true from a set of statements or constraints.' },
  { slug: 'visual-reasoning', name: 'Visual Reasoning', description: 'Reason about shapes, folding, rotation, targets and other spatial figures.' },
  { slug: 'evaluating-evidence', name: 'Evaluating Evidence', description: 'Judge which statement strengthens, weakens or is unsupported by the given evidence.' },
  { slug: 'identifying-similarity', name: 'Identifying Similarity', description: 'Recognise the shared relationship or pattern that makes two things analogous.' },
  { slug: 'relevant-selection', name: 'Relevant Selection', description: 'Select only the information that is relevant to determining an outcome from a set of conditions.' },
];

// Helper to build a StimulusSpec JSON string.
const stim = (text: string, figures: unknown[]) => JSON.stringify({ version: 1, text, figures });

export const THINKING_SKILLS_QUESTIONS: TSQuestionSeed[] = [
  // ── Finding Procedures ────────────────────────────────────────────────────
  {
    topicSlug: 'finding-procedures',
    questionText: 'The table shows a museum\'s admission fees and the additional cost of a guided tour. One 16-year-old boy wants to visit the museum. How much does he pay in total for admission plus a guided tour?',
    options: ['$28', '$30', '$38', '$40'],
    correctIndex: 1,
    explanation: 'A 16-year-old is a Child (6–17 y/o): admission $18 + guided tour $12 = $30. Therefore, the answer is Option B.',
    stimulus: stim('Museum admission fees and guided-tour costs.', [
      { kind: 'table', columns: ['Age group', 'Admission fee', 'Guided tour'], rows: [['Adult (18 and above)', '$25', '$16'], ['Child (6–17)', '$18', '$12'], ['Child (below 6)', '$12', '$8'], ['Family (2 adults, 2 children)', '$70', '$48']] },
    ]),
  },
  {
    topicSlug: 'finding-procedures',
    questionText: 'At an animal enclosure there are kangaroos, tigers and owls, with at least one of each. Kangaroos have 2 legs, tigers have 4 legs and owls have 2 legs. There are 12 animals and 28 legs in total. What is the maximum number of owls that could be in the enclosure?',
    options: ['7', '8', '9', '10'],
    correctIndex: 2,
    explanation: 'To maximise owls, minimise tigers. With 10 owls, 1 kangaroo, 1 tiger: 12 animals and 10×2 + 1×2 + 1×4 = 26 legs — two short. Swapping one owl for a tiger adds 2 legs: 9 owls, 1 kangaroo, 2 tigers = 12 animals and 28 legs. So the maximum is 9 owls. Therefore, the answer is Option C.',
  },

  // ── Evaluating Reasoning Errors ───────────────────────────────────────────
  {
    topicSlug: 'evaluating-reasoning-errors',
    questionText: 'A school pays a security guard $50,000 a year to deter crime; anyone caught committing a crime is expelled. There has been no crime at the school for 3 years. Sean says: "The school is wasting money on the guard — no one commits crimes here, so the guard isn\'t doing anything useful." Which of the following shows the mistake Sean has made?',
    options: [
      'The school may have excess funds which they must spend on a security guard',
      'The security guard may not be doing their job properly, so the school does not know of the crimes',
      'The security guard\'s presence may be the reason that no crimes are being committed',
      'The school may not be able to call the police in time when a crime occurs',
    ],
    correctIndex: 2,
    explanation: 'Sean assumes the absence of crime means the guard does nothing, but the guard\'s presence may be exactly what deters the crime. Therefore, the answer is Option C.',
  },
  {
    topicSlug: 'evaluating-reasoning-errors',
    questionText: 'A report states: "When it is raining, public transport such as buses and trains always experience delays, so many people prefer to drive to avoid the delays." Hayley says: "It is raining this morning, so I should drive rather than take public transport if I want to avoid being late." If the quoted paragraph is true, which of the following shows the mistake Hayley has made?',
    options: [
      'On rainy days the traffic is likely to be worse due to more people driving',
      'Driving does not guarantee that Hayley will not be late to work',
      'Driving is more dangerous in wet weather compared to dry weather',
      'It may stop raining by the time Hayley needs to travel to work',
    ],
    correctIndex: 1,
    explanation: 'The passage only says public transport is delayed, not that driving arrives on time. Hayley wrongly assumes driving guarantees she won\'t be late. Therefore, the answer is Option B.',
  },

  // ── Logical Analysis ──────────────────────────────────────────────────────
  {
    topicSlug: 'logical-analysis',
    questionText: 'Four friends — Sally, Fred, David and Adam — ran a marathon. Sally finished ahead of Fred. David finished behind Sally. Adam did not finish last. Which one of the following MUST be true?',
    options: ['Sally finished first', 'Fred finished ahead of David', 'Adam finished ahead of David and Fred', 'None of the above'],
    correctIndex: 3,
    explanation: 'Adam not finishing last could mean he beat Sally and came first, so (a) isn\'t forced. David could be ahead of or behind Fred, so (b) and (c) aren\'t forced. Only "None of the above" must be true. Therefore, the answer is Option D.',
  },
  {
    topicSlug: 'logical-analysis',
    questionText: 'Recruiters pick the contestant with the best vocals among Albert, Suzy, Sam and Brandon. Albert\'s vocals are better than Brandon\'s, but Brandon\'s vocals are better than Suzy\'s. Brandon\'s dancing is better than Albert\'s but not as good as Sam\'s. Albert does not have the best vocals. Who has the best vocals?',
    options: ['Albert', 'Suzy', 'Sam', 'Brandon'],
    correctIndex: 2,
    explanation: 'Vocals rank Albert > Brandon > Suzy, and Albert is not best, so someone beats Albert — that can only be Sam. So Sam has the best vocals. Therefore, the answer is Option C.',
  },

  // ── Visual Reasoning ──────────────────────────────────────────────────────
  {
    topicSlug: 'visual-reasoning',
    questionText: 'Kyle throws three darts at the target shown. The four rings are worth 1, 3, 6 and 10 points from the outermost ring to the bullseye. His three darts land as shown. What did Kyle score in total?',
    options: ['10', '15', '17', '20'],
    correctIndex: 0,
    explanation: 'Kyle\'s darts land in the outer (1), second (3) and third (6) rings, missing the bullseye. 1 + 3 + 6 = 10. Therefore, the answer is Option A.',
    stimulus: stim('Kyle\'s three darts on the target (ring values 1, 3, 6, 10 from outside to the bullseye).', [
      { kind: 'target', rings: [1, 3, 6, 10], darts: [0, 1, 2] },
    ]),
  },
  {
    topicSlug: 'visual-reasoning',
    questionText: 'A square piece of paper is folded exactly in half, then folded in half again. A single hole is cut through the folded paper, which is then unfolded completely. How many holes are in the unfolded paper?',
    options: ['1', '2', '4', '8'],
    correctIndex: 2,
    explanation: 'Two folds stack the paper into 4 layers, so a single cut passes through all 4 layers. Unfolded, there are 4 holes. Therefore, the answer is Option C.',
    stimulus: stim('A square folded in half twice, with a single hole cut through all the layers.', [
      { kind: 'fold-cut', foldCount: 2, cut: 'centre', cutShape: 'circle' },
    ]),
  },

  // ── Evaluating Evidence ───────────────────────────────────────────────────
  {
    topicSlug: 'evaluating-evidence',
    questionText: 'Sally\'s father says children should not lift weights because it will make them short as adults, so he has banned Sally from weightlifting until she is fully grown. Which of the following, if true, most weakens Sally\'s father\'s argument?',
    options: [
      'Children\'s growth plates close once they become adults',
      'On average, those who weightlifted regularly as children are the same height as the general population',
      'Most professional and elite weightlifters that Sally knows are short',
      'Weightlifting releases a hormone which improves athletic ability',
    ],
    correctIndex: 1,
    explanation: 'The claim is that childhood weightlifting stunts height. Evidence that childhood weightlifters end up the same average height directly undermines that link. Therefore, the answer is Option B.',
  },
  {
    topicSlug: 'evaluating-evidence',
    questionText: 'A survey interviewed 200 successful business owners; only 20 had gone to university, but all had graduated high school. Tobi says: "Business owners are more likely to succeed if they don\'t go to university." Tyrone says: "Most successful owners skipped university and focused on their business after high school." If the passage is true, whose reasoning is correct?',
    options: ['Tobi only', 'Tyrone only', 'Both Tobi and Tyrone', 'Neither Tobi nor Tyrone'],
    correctIndex: 3,
    explanation: 'The survey only sampled successful owners, so it says nothing about unsuccessful ones — Tobi cannot conclude non-university owners are more likely to succeed. Tyrone assumes they focused on business, which the passage never states. Both are unsupported. Therefore, the answer is Option D.',
  },

  // ── Identifying Similarity (authored at PDF difficulty/format — analogy style) ─
  {
    topicSlug: 'identifying-similarity',
    questionText: '"Glove" relates to "Hand" in a certain way. Which word relates to "Sock" in the same way?',
    options: ['Shoe', 'Foot', 'Wool', 'Knee'],
    correctIndex: 1,
    explanation: 'A glove is worn on a hand; by the same relationship, a sock is worn on a foot. Therefore, the answer is Option B.',
  },
  {
    topicSlug: 'identifying-similarity',
    questionText: 'In a pattern, 2 becomes 8, 3 becomes 27 and 4 becomes 64. Using the same rule, what does 5 become?',
    options: ['25', '75', '100', '125'],
    correctIndex: 3,
    explanation: 'Each number is cubed: 2³ = 8, 3³ = 27, 4³ = 64. So 5³ = 125. Therefore, the answer is Option D.',
  },

  // ── Relevant Selection ────────────────────────────────────────────────────
  {
    topicSlug: 'relevant-selection',
    questionText: 'To be eligible for a promotion at Sanscorp an employee must: have a 95% attendance rate; have worked at the company for 10 years; have led at least 3 successful projects; have worked under a senior manager for at least 3 years; and have completed a conflict-resolution course outside work hours. Alaina says: "I\'ve worked at Sanscorp for 12 years, my last two projects have been my only successful projects, and I\'ve worked under senior manager Darius for the last 3 projects." Which of the following do we know for certain is a reason Alaina is NOT eligible?',
    options: [
      'Alaina\'s attendance rate is less than 95%',
      'Alaina has not led at least 3 successful projects',
      'Alaina has not led any projects',
      'Alaina worked under a senior manager for less than 3 years',
    ],
    correctIndex: 1,
    explanation: 'Alaina states only two successful projects, so she certainly has not led at least 3 — a definite disqualifier. The other options are not established by her statement. Therefore, the answer is Option B.',
  },
  {
    topicSlug: 'relevant-selection',
    questionText: 'Students may join Pottery only if they have over 80% attendance, over 80% in Visual Arts, and have failed fewer than 2 subjects. The second table shows three students\' results. Who can join Pottery?',
    options: ['Adam', 'Barry', 'Cathy and Adam', 'No one'],
    correctIndex: 2,
    explanation: 'Pottery needs >80% attendance, >80% Visual Arts and fewer than 2 failed subjects. Barry\'s Visual Arts is 78% (not over 80), so he is out. Adam (95/93/0) and Cathy (96/91/1) both qualify. Therefore, the answer is Option C.',
    stimulus: stim('Pottery conditions and the three students\' results.', [
      { kind: 'table', columns: ['Pottery requirement', 'Threshold'], rows: [['Attendance', 'over 80%'], ['Visual Arts', 'over 80%'], ['Failed subjects', 'fewer than 2']] },
      { kind: 'table', columns: ['', 'Adam', 'Barry', 'Cathy'], rows: [['Attendance (%)', 95, 82, 96], ['Visual Arts (%)', 93, 78, 91], ['Failed subjects', 0, 2, 1]] },
    ]),
  },
];

// Seed the 7 sections + exemplar bank questions (idempotent, mirroring seedMath). Skills are seeded
// by seedSkills (THINKING_SKILLS), which runs after this so it can look topics up by slug.
export async function seedThinkingSkills(prisma: PrismaClient) {
  console.log('Seeding Thinking Skills data...');

  const topicMap: Record<string, number> = {};
  for (const t of THINKING_SKILLS_TOPICS) {
    const created = await prisma.mathTopic.upsert({
      where: { slug: t.slug },
      update: { subject: 'thinking-skills', name: t.name, description: t.description },
      create: { subject: 'thinking-skills', name: t.name, slug: t.slug, description: t.description },
    });
    topicMap[t.slug] = created.id;
    console.log(`  ✓ Thinking Skills section: ${t.name}`);
  }

  for (const q of THINKING_SKILLS_QUESTIONS) {
    const topicId = topicMap[q.topicSlug];
    if (!topicId) {
      console.error(`  ✗ Section not found: ${q.topicSlug}`);
      continue;
    }
    let stimulusGroupId: number | null = null;
    if (q.stimulus) {
      const existing = await prisma.mathStimulusGroup.findFirst({ where: { stimulus: q.stimulus } });
      stimulusGroupId = existing
        ? existing.id
        : (await prisma.mathStimulusGroup.create({ data: { stimulus: q.stimulus } })).id;
    }
    const existingQ = await prisma.mathQuestion.findFirst({ where: { questionText: q.questionText, topicId } });
    if (!existingQ) {
      await prisma.mathQuestion.create({
        data: {
          topicId,
          stimulusGroupId,
          questionText: q.questionText,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        },
      });
    } else if (stimulusGroupId && existingQ.stimulusGroupId !== stimulusGroupId) {
      await prisma.mathQuestion.update({ where: { id: existingQ.id }, data: { stimulusGroupId } });
    }
  }
  console.log('Thinking Skills seed complete.');
}
