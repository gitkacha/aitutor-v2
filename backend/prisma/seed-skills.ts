import type { PrismaClient } from '@prisma/client';

// M3a Task 2 — the approved 89-skill NSW Selective taxonomy (82 math skills across the
// 20 math topics, plus 7 writing criteria). Slugs/names are the approved closed tag list
// consumed by Tasks 8-10; descriptions and examLevelNotes are authored at NSW Selective
// Placement Test level (Mathematical Reasoning: 35 multiple-choice questions in 40 minutes,
// students aged 10-12) and are written for an adult tutor, not the child.

export interface SkillSeed {
  slug: string;
  name: string;
  description: string;
  examLevelNotes: string;
}

export const MATH_SKILLS: Record<string, SkillSeed[]> = {
  'number-sentences': [
    {
      slug: 'balancing-number-sentences',
      name: 'Balancing Number Sentences',
      description: 'Finding the missing number that makes both sides of an equation equal, treating the equals sign as a balance rather than an instruction to compute.',
      examLevelNotes: 'Questions give an equation such as 34 + ? = 6 x 9 or a two-sided sentence with one blank, and the student must find the value that balances it. Mastery means evaluating the complete side first, then working back — within about 30 seconds. The classic trap is reading the equals sign as "the answer comes next" and writing the result of the left side into the blank. Watch for sentences where the blank sits on the left, which reverses the usual reading order.',
    },
    {
      slug: 'inverse-operations',
      name: 'Inverse Operations',
      description: 'Using the opposite operation (addition/subtraction, multiplication/division) to unwind a calculation and recover an unknown starting value.',
      examLevelNotes: 'Typical forms are "I think of a number, multiply by 4, then subtract 7 and get 33 — what was my number?" chains of two or three steps. Mastery means reversing the whole chain in the opposite order, not just reversing each operation in the order given. The common error is unwinding the steps forwards (reversing the first step first), which gives a plausible wrong answer that usually appears among the options. Students should verify by running their answer forwards through the original chain — a 10-second check that catches most slips.',
    },
    {
      slug: 'order-of-operations',
      name: 'Order of Operations',
      description: 'Applying the correct precedence of brackets, multiplication/division and addition/subtraction when evaluating a multi-operation expression.',
      examLevelNotes: 'Questions present an expression like 48 - 6 x 4 + 12 / 3 or ask which placement of brackets makes a statement true. At this level students must know multiplication and division rank equally and are worked left to right — the misconception that multiplication always precedes division is a deliberate distractor. Strict left-to-right evaluation is the most common wrong answer and is always among the options. Fluent students evaluate a four-operation expression in under 40 seconds without writing intermediate steps.',
    },
    {
      slug: 'missing-operator-problems',
      name: 'Missing Operator Problems',
      description: 'Choosing which operations (+, -, x, /) fill the gaps in a number sentence to make it true, or selecting the number sentence that models a worded situation.',
      examLevelNotes: 'Two forms appear: inserting operators into a sentence like 8 ? 4 ? 2 = 16, and choosing which of five number sentences matches a sharing/grouping story (e.g. "238 shared among 22 people gives 10 each with 18 left over" -> 22 x 10 + 18 = 238). The story form is more common in the Selective paper and rewards translating each phrase to a term rather than computing anything. Traps include remainder handled with the wrong sign (- instead of +) and multiplication swapped for addition. Strong students eliminate options by estimating magnitude before testing exactly.',
    },
  ],
  probability: [
    {
      slug: 'probability-as-fraction',
      name: 'Probability as a Fraction',
      description: 'Expressing the chance of an event as favourable outcomes over total outcomes, and converting between fraction, decimal and percentage forms.',
      examLevelNotes: 'Standard questions involve marbles, spinners or cards: "a bag has 5 red, 3 blue, 4 green — what is the probability of blue?" Harder Selective variants run the logic backwards: given a probability and a partial count, find a missing quantity (e.g. 75% chance of yellow after removing 16 pink from 60 -> how many red?). Mastery means moving between 3/4, 0.75 and 75% without hesitation. The main trap is putting the favourable count over the count of other outcomes instead of the total.',
    },
    {
      slug: 'listing-outcomes',
      name: 'Listing Outcomes',
      description: 'Enumerating the full set of equally likely outcomes of an experiment (dice, coins, spinners, draws) as the basis for a probability calculation.',
      examLevelNotes: 'Questions require the complete outcome set before any probability can be found — two coins tossed, a die rolled twice, or one item drawn from each of two groups. The near-universal error is missing outcomes or double-counting ordered pairs: students say two coins have three outcomes (HH, HT, TT) because they treat HT and TH as the same. Mastery means listing systematically (fix the first element, cycle the second) and knowing when order matters. At exam pace the outcome set should be down on paper within 30 seconds so the remaining time goes to the actual question.',
    },
    {
      slug: 'complementary-events',
      name: 'Complementary Events',
      description: 'Using the fact that an event and its opposite have probabilities summing to 1 to find "the chance it does not happen".',
      examLevelNotes: 'Typical wording: "the probability of rain is 0.35 — what is the probability it does not rain?" or multi-category versions where the complement is "any colour except red". Mastery means recognising that computing the complement is usually faster than adding several favourable cases, a genuine time-saver on a 40-minute paper. The traps are subtracting from the wrong whole (e.g. from 100 when the probabilities are fractions of 1) and forgetting one category when summing "everything else". Students should be fluent with complements in fraction, decimal and percentage form.',
    },
    {
      slug: 'comparing-likelihoods',
      name: 'Comparing Likelihoods',
      description: 'Deciding which of several events is more or less likely by comparing probabilities expressed in different forms or arising from different-sized pools.',
      examLevelNotes: 'Selective questions ask which spinner, bag or class gives the best chance of a target outcome, where the pools have different totals — 3 winners in 10 tickets versus 5 in 18. Mastery means converting to a common form (decimals or percentages are fastest) rather than judging by raw counts. The designed trap is choosing the option with more favourable outcomes while ignoring the larger total. Equivalent-fraction fluency matters here; a student who cannot rapidly see 3/10 = 0.30 versus 5/18 = 0.28 will lose a full minute.',
    },
  ],
  combinations: [
    {
      slug: 'systematic-listing',
      name: 'Systematic Listing',
      description: 'Writing out all possibilities of a small combinatorial situation in a fixed order so that nothing is missed and nothing is counted twice.',
      examLevelNotes: 'Used when the numbers are small enough to enumerate — three-digit numbers from given digits, seating orders of three children, or outfits from two shirts and three shorts. Mastery is a disciplined convention (fix the first item, cycle the rest, then advance the first item) rather than scattergun listing. Common errors are skipping a case mid-list and including forbidden cases (e.g. numbers starting with 0). Under time pressure students should also recognise when the count is too large to list and a multiplication shortcut is needed instead.',
    },
    {
      slug: 'counting-arrangements',
      name: 'Counting Arrangements',
      description: 'Counting ordered arrangements by multiplying the number of choices at each position, including cases where items cannot repeat.',
      examLevelNotes: 'Standard forms: how many three-digit numbers can be made from five digits without repetition (5 x 4 x 3), or how many ways can four students line up (4 x 3 x 2 x 1). Mastery means seeing each position as a slot whose choice count shrinks when repetition is banned. The two big traps are forgetting the shrink (answering 5 x 5 x 5) and mishandling constraints such as "must not start with zero", which is resolved by filling the restricted slot first. Fluent students answer unconstrained versions in under 30 seconds.',
    },
    {
      slug: 'pairing-combinations',
      name: 'Pairing and Combinations',
      description: 'Counting selections where order does not matter — handshakes, matches between teams, or choosing items from menus — including multiplying independent choices.',
      examLevelNotes: 'Two recurring forms: independent choices multiplied together (9 flavours x 18 toppings x 5 fruits = 810 orders — a direct past-paper style) and unordered pairs ("6 teams each play every other team once"), which follow n x (n-1) / 2. The signature trap in pairing questions is forgetting to halve, giving double the answer — and the doubled value is always an option. Mastery means classifying the question first: does order matter, and are the choices independent? Misclassification, not arithmetic, is what loses this mark.',
    },
    {
      slug: 'tree-diagrams',
      name: 'Tree Diagrams',
      description: 'Building or reading branching diagrams that show every sequence of outcomes across two or more stages of an experiment or decision.',
      examLevelNotes: 'Questions either present a partially drawn tree to complete or describe a two/three-stage situation (spin then toss; choose route then transport) where a tree is the reliable path to the outcome count. Mastery means knowing the leaf count equals the product of branch counts at each stage, so the tree can often be replaced by multiplication once the structure is seen. Traps include unequal branching (some choices exclude later options — the tree is not symmetric) and counting internal nodes instead of leaves. Strong students draw compressed trees with counts on branches instead of full diagrams, which is essential at 68 seconds a question.',
    },
  ],
  arithmetic: [
    {
      slug: 'mental-addition-subtraction',
      name: 'Mental Addition and Subtraction',
      description: 'Adding and subtracting whole numbers mentally using compensation, bridging and reordering strategies rather than column algorithms.',
      examLevelNotes: 'Rarely tested bare; this is the substrate of nearly every multi-step word problem, so weakness here taxes the entire paper. Mastery at Selective level means three-digit sums and differences in a few seconds using strategies like 398 + 267 = 400 + 267 - 2, and comfortable subtraction across zeros (1000 - 463). The recurring error is compensation applied in the wrong direction (adding the adjustment when it should be subtracted). Tutors should drill until working memory is free for the problem structure, not the arithmetic.',
    },
    {
      slug: 'mental-multiplication-strategies',
      name: 'Mental Multiplication Strategies',
      description: 'Multiplying efficiently in the head by splitting numbers, using doubling and halving, and exploiting known facts (e.g. 25 x 16 = 25 x 4 x 4).',
      examLevelNotes: 'Selective questions assume instant recall of tables to 12 and expect two-digit-by-one-digit and easy two-digit-by-two-digit products without written long multiplication. Key strategies to secure: distributive splitting (23 x 7 = 140 + 21), doubling/halving (16 x 35 = 8 x 70), and multiplying by 5 via x10 / 2. The typical failure is not a wrong strategy but defaulting to the written algorithm, which costs 40-60 seconds the paper does not allow. Watch for partial-product errors when splitting (forgetting to multiply the ones digit).',
    },
    {
      slug: 'faster-long-division',
      name: 'Faster Long Division',
      description: 'Dividing by one- and two-digit divisors quickly using short division, chunking, and factor tricks, with correct handling of remainders.',
      examLevelNotes: 'Division appears constantly inside sharing problems, rate problems and remainder puzzles (e.g. "which of these leaves a different remainder when divided by 6?" — a real past-paper form). Mastery means short division for one-digit divisors, chunking off friendly multiples for two-digit divisors (e.g. 238 / 22 via 220), and splitting a divisor into factors (divide by 6 = divide by 2 then 3). The recurring traps are misplacing a zero in the quotient and stating the remainder when the question wants the quotient or vice versa. Students should also interpret remainders in context — "how many buses are needed" rounds up.',
    },
    {
      slug: 'decimal-operations',
      name: 'Decimal Operations',
      description: 'Adding, subtracting and multiplying decimals accurately, keeping track of place value and the position of the decimal point.',
      examLevelNotes: 'Appears directly and inside measurement and money contexts — summing lengths like 6.4 cm + 3.0 cm + 12 cm in a perimeter question is a genuine Selective task. Mastery means aligning place values when adding/subtracting (the classic error is right-aligning 12.5 + 3.75 as if they were whole numbers) and counting decimal places when multiplying. Multiplying by 10/100/1000 should be instant digit-shifting, not an algorithm. Mixed whole-number-and-decimal sums are the most error-prone form; encourage padding with zeros (12.00) before adding.',
    },
    {
      slug: 'decimal-division',
      name: 'Decimal Division',
      description: 'Dividing decimals by whole numbers and dividing by decimals via equivalent scaling, including converting fractions to decimals by division.',
      examLevelNotes: 'Selective contexts include unit pricing ($4.80 for 6), scaling recipes (150 mL for 1.5 servings -> 100 mL per serving — a past-paper structure), and average speed. Mastery means dividing a decimal by a whole number with short division, and rewriting division by a decimal as an equivalent whole-number division (4.8 / 0.6 = 48 / 6). The core trap is misplacing the decimal point by an order of ten — estimation ("should the answer be near 8 or 0.8?") catches this and should be habitual. Fluency converting simple fractions (1/8 = 0.125, 3/4 = 0.75) by division is also expected.',
    },
    {
      slug: 'money-calculations',
      name: 'Money Calculations',
      description: 'Computing totals, change, unit prices and best-buy comparisons in dollars and cents, including multi-item and bulk-pack pricing.',
      examLevelNotes: 'The signature Selective form is the best-buy table: pack sizes with prices, "what is the cheapest way to buy 12 large prints?" — where the intended answer often buys more than needed because a bigger pack is cheaper (a 15-pack at $21 beats two 10-packs). Mastery means computing unit prices or comparing totals across combinations rather than assuming exact quantities. Traps: assuming the exact-quantity combination is cheapest, and dollar/cent slips such as treating $0.85 as 85 dollars. Change-from-$50 style subtraction should be automatic via counting up.',
    },
    {
      slug: 'estimation-rounding',
      name: 'Estimation and Rounding',
      description: 'Rounding values to a suitable precision to estimate a result, judge the reasonableness of an answer, or eliminate impossible options.',
      examLevelNotes: 'Directly tested ("estimate 4.9 x 61 by rounding") but more valuable as an exam technique: on a five-option multiple-choice paper, a quick magnitude estimate eliminates two or three distractors before any exact work. Mastery means rounding both operands sensibly and knowing which direction the estimate errs. Traps include rounding mid-calculation and compounding the error, and rounding 5s inconsistently. Tutors should train the reflex "estimate first, then compute" — it converts careless errors into caught errors at almost zero time cost.',
    },
  ],
  patterns: [
    {
      slug: 'number-sequence-rules',
      name: 'Number Sequence Rules',
      description: 'Identifying the rule linking consecutive terms of a sequence — including two-step rules like "multiply then add" — and using it to find missing terms.',
      examLevelNotes: 'Selective sequences are rarely simple add-a-constant: expect two-step rules such as "x3 then +1" (3, 10, 31, 94, 283 — an actual past-paper item) or alternating operations. Mastery means testing a hypothesis against at least two consecutive gaps before committing, since a rule fitted to one gap is where most wrong answers come from. Missing terms in the middle of a sequence are the standard format, so the rule must be run both forwards and backwards. Fast differencing (writing the gaps between terms) should be the automatic first move.',
    },
    {
      slug: 'geometric-growth-patterns',
      name: 'Geometric Growth Patterns',
      description: 'Working with patterns that grow by repeated multiplication — doubling, tripling — including growth in context such as folding, splitting or spreading.',
      examLevelNotes: 'Contexts include cells doubling every hour, paper folding, and prize money tripling each round; the question asks for a term several steps ahead or "when does it first exceed N?". Mastery means recognising multiplicative growth from the ratio of consecutive terms and iterating quickly without a calculator. The essential trap is treating growth as additive (adding the first difference repeatedly) — the additive answer is always among the options. Off-by-one errors on the step count ("after 5 doublings" versus "the 5th term") are the other consistent mark-loser.',
    },
    {
      slug: 'pattern-nth-term',
      name: 'Pattern to Nth Term',
      description: 'Jumping from a pattern rule to a far-away term (the 20th, 50th, 100th) without writing every intermediate term, using position-based reasoning.',
      examLevelNotes: 'For linear patterns, mastery means the position-times-difference shortcut: a pattern with constant difference 4 starting at 7 has nth term 4n + 3, so term 50 is 203 — found in seconds, not by extending 50 terms. Formal algebra is not required, but "difference times position, then adjust" reasoning is. Traps: using n x difference without the adjustment (off by the constant), and off-by-one from counting the first term as position 0. Repeating patterns (e.g. a colour cycle of length 6 — what colour is the 75th?) belong here too and are solved with remainders, where remainder-0 handling is the classic slip.',
    },
    {
      slug: 'shape-patterns',
      name: 'Shape Patterns',
      description: 'Extending visual patterns of shapes or tiles, translating the picture into a number pattern or coordinate rule to predict later stages.',
      examLevelNotes: 'The Selective paper poses these visually: matchstick figures, growing tile arrangements, or tiles placed on a labelled grid where the answer is a set of coordinates (e.g. "which cells hold the next three black tiles?" — a past-paper form). Mastery means converting the picture to numbers (count sticks per stage, or track row position against column) instead of drawing every stage. Traps include miscounting shared edges in matchstick figures and misreading grid coordinates (row/column swapped). Students should verify the rule against the last given stage before extrapolating.',
    },
  ],
  'protractor-skills': [
    {
      slug: 'measuring-angles',
      name: 'Measuring Angles with a Protractor',
      description: 'Reading an angle from a pictured protractor, including angles between two rays that both sit away from zero, using the correct scale.',
      examLevelNotes: 'The exam shows a protractor image with rays at marked positions; the angle is the difference between the two readings (rays at 15 and 115 -> 100 degrees — a genuine past-paper setup). Mastery means using one scale consistently and subtracting readings when neither ray sits on zero. The two designed traps are reading the wrong scale (giving the supplement, 80 instead of 100) and reporting a single ray\'s reading as the angle. Multi-ray diagrams asking for a combination of two angles also appear; treat each angle as a subtraction, then combine.',
    },
    {
      slug: 'estimating-angles',
      name: 'Estimating Angles',
      description: 'Judging the approximate size of an angle by eye using benchmark angles (45, 90, 135, 180 degrees) without a measuring tool.',
      examLevelNotes: 'Tested directly ("which is the best estimate of this angle?") and used defensively — an estimate instantly rules out protractor-scale misreadings, since an angle that is visibly acute cannot be 130 degrees. Mastery means comparing against mental benchmarks: quarter turn, half of a right angle, and halfway between benchmarks. The reliable trap is options placed exactly at the supplement (50 versus 130), catching students who do not sanity-check against the picture. Train the habit of classifying acute/obtuse before choosing any numeric option.',
    },
    {
      slug: 'angle-types',
      name: 'Angle Types',
      description: 'Classifying angles as acute, right, obtuse, straight or reflex, and knowing the degree ranges each type covers.',
      examLevelNotes: 'Questions ask directly for a classification, or embed it — "the reflex angle at the centre" requires knowing that the reflex angle is 360 minus the marked angle (a past-paper item cut a sector from a circle and asked for the larger central angle: 360 - 100 = 260). Mastery means instant recall of the boundaries: acute < 90, obtuse between 90 and 180, reflex between 180 and 360. The dominant trap is ignoring the word "reflex" and answering with the smaller angle, which always appears among the options. Vocabulary precision here is cheap marks; there is no computation to get wrong.',
    },
    {
      slug: 'angles-on-lines-and-points',
      name: 'Angles on Lines and Around Points',
      description: 'Using angle facts — angles on a straight line sum to 180, angles around a point sum to 360, vertically opposite angles are equal — to find unknown angles.',
      examLevelNotes: 'Questions show intersecting lines or angles fanned around a point, with one or two unknowns to find via the sum facts; triangle angle sum (180) also appears in combination. Mastery means chaining two facts in one problem (find one angle on the line, then use vertical opposition) in under a minute. Traps include applying the 180 fact to angles that only look like they sit on a straight line, and arithmetic slips when three or more angles share the point. Encourage writing the equation (x + 47 + 90 = 180) rather than juggling mentally — it prevents the sign errors that dominate wrong answers here.',
    },
  ],
  time: [
    {
      slug: 'elapsed-time',
      name: 'Elapsed Time',
      description: 'Calculating the duration between two clock times, or a start/end time given a duration, across hour boundaries and across noon or midnight.',
      examLevelNotes: 'Selective questions chain durations with constraints: "arrive by 8:55 am; preparation takes up to 33 minutes, locking up 8 minutes, the drive up to 1.5 hours — latest start time?" (a past-paper structure requiring the worst case of every range). Mastery means bridging through round hours rather than column subtraction, and knowing that "latest departure" questions need the maximum of each duration range. The fatal error is subtracting times as decimals (8:55 - 2.11); minutes are base-60. Crossing 12:00 and next-day arrivals are standard complications, not edge cases.',
    },
    {
      slug: 'timetable-reading',
      name: 'Timetable Reading',
      description: 'Extracting departure, arrival and journey information from bus, train or event timetables and combining rows and columns to answer planning questions.',
      examLevelNotes: 'Expect a realistic grid and a constraint question: "latest bus that arrives before 10:20", "how long does the 9:14 service take?", or combining two legs with a connection. Mastery means reading down the correct column, computing durations between grid entries quickly, and respecting the direction of the constraint (before/after). Traps: choosing the first service that departs after a time when the question asks about arrival, and missing that some services skip stops (blank cells). These are low-difficulty marks lost almost entirely to misreading rather than mathematics.',
    },
    {
      slug: '24-hour-time',
      name: '24-Hour Time',
      description: 'Converting between 12-hour (am/pm) and 24-hour time formats and computing with times expressed in 24-hour notation.',
      examLevelNotes: 'Appears inside timetable and travel questions — transport timetables typically use 24-hour notation, so conversion is a gatekeeper skill rather than the headline question. Mastery means instant two-way conversion (subtract 12 for pm displays after 12:59, and know 00:xx is just after midnight). The persistent traps are the noon/midnight pair (12:00 vs 00:00) and mistakes like reading 14:30 as 4:30 pm. Fluency target: any single conversion in under five seconds, because the real question still lies ahead.',
    },
    {
      slug: 'calendar-problems',
      name: 'Calendar Problems',
      description: 'Reasoning with days, weeks and months — what day falls N days later, day-of-week cycles, and date arithmetic across month boundaries.',
      examLevelNotes: 'Typical forms: "the 3rd of March is a Friday — what day is the 29th?", counting days between two dates, and recurring-event questions ("every 6 days" — which link to LCM). Mastery means working modulo 7 (26 days later = 3 weeks and 5 days, so advance 5 days) instead of counting days one by one. The two classic traps are the fencepost error (inclusive versus exclusive counting of the start day) and wrong month lengths — the 30/31-day pattern and February must be known cold. Leap-year handling can appear but is usually signposted.',
    },
  ],
  'magic-squares': [
    {
      slug: 'magic-square-completion',
      name: 'Magic Square Completion',
      description: 'Filling missing cells of a magic square so every row, column and diagonal reaches the same total.',
      examLevelNotes: 'The exam gives a 3x3 grid with several blanks and asks for one specific missing cell (a past-paper item gives a completed diagonal 11, 12, 13 -> constant 36, then chases the target cell through two lines). Mastery means finding a fully-known line first to establish the magic constant, then solving cells in dependency order — each new cell should come from a line with exactly one blank. The trap is assuming a constant from an incomplete line, or forgetting the diagonals count too. Efficient students reach the target cell in two or three subtractions, around 60 seconds total.',
    },
    {
      slug: 'magic-constant-reasoning',
      name: 'Magic Constant Reasoning',
      description: 'Reasoning about the magic total itself — deriving it from the numbers used or from the centre cell, without completing the whole square.',
      examLevelNotes: 'Higher-order questions ask for the magic constant of a square using 1-9 (sum 45 across three rows -> 15), or exploit the fact that the centre of a 3x3 magic square is one third of the constant. Mastery means using these structural facts to shortcut: many questions are answerable without filling a single cell. The trap is grinding out a full completion when one deduction suffices — a time trap rather than an accuracy trap. Questions may also ask which value cannot appear in a given position; these reward knowing the centre and corner properties.',
    },
    {
      slug: 'grid-logic-deduction',
      name: 'Grid Logic Deduction',
      description: 'Solving grid puzzles with numeric constraints beyond classic magic squares — row/column sum grids, arithmetic crosses and constraint-elimination puzzles.',
      examLevelNotes: 'The paper uses magic-square-adjacent puzzles: grids where each row and column must hit a stated (possibly different) total, or shapes whose overlapping cells belong to two sums. Mastery means the same discipline as magic squares — always work the line with one unknown — plus elimination when a cell has candidate values. Traps include overlooking that a shared cell contributes to two constraints and arithmetic slips accumulating across a chain of deductions (verify the completed grid against every constraint, a 15-second insurance). These questions are time-heavy; students should recognise when to defer them to the end of the paper.',
    },
  ],
  'data-interpretation': [
    {
      slug: 'reading-tables',
      name: 'Reading Tables',
      description: 'Locating and combining values from data tables — price grids, results tables, frequency tables — to answer direct and comparison questions.',
      examLevelNotes: 'Selective tables are dense (e.g. a 3x3 price grid of pack sizes by product size) and the question is rarely a single lookup — expect "cheapest way to buy 12 large" style optimisation over table entries (a past-paper form). Mastery means precise row/column indexing under time pressure and a willingness to compute two or three candidate combinations before choosing. The dominant error is reading the adjacent row or column — mechanical, not conceptual — so train finger-tracing or edge-alignment habits. Totals and differences across a row are expected to be mental arithmetic.',
    },
    {
      slug: 'bar-and-line-graphs',
      name: 'Bar and Line Graphs',
      description: 'Reading values, differences and trends from bar charts and line graphs, including axis scales that count in steps other than one.',
      examLevelNotes: 'The past papers lean on multi-part line-graph stimuli (a distance-time graph of a full day supported four separate questions). Mastery means reading the axis scale first — Selective axes step in 2s, 4s or 5s deliberately — and interpolating between gridlines. On distance-time graphs specifically: flat segments mean stationary, steeper means faster, and total distance is the sum of segment changes, not the final y-value when the graph can plateau. Traps: treating each gridline as 1 unit, and answering from the wrong series when two lines share the chart.',
    },
    {
      slug: 'pie-charts-proportions',
      name: 'Pie Charts and Proportions',
      description: 'Interpreting pie charts as fractions or percentages of a whole, converting between sector angle, percentage and count, and inferring unlabelled sectors.',
      examLevelNotes: 'Selective pie questions withhold labels: sectors are drawn to scale but unlabelled, and the student infers a missing percentage from visual size plus the constraint that the whole is 100% (a past-paper item asks which value "could" fill the unknown sector). The other standard form scales a sector to a count: "15% is 18 visitors, so the total is 18 / 0.15 = 120". Mastery means fluent conversion between angle (of 360), percentage and quantity, and using quarter/half visual benchmarks. The trap is confusing a sector\'s percentage with its raw count, or summing known sectors to something other than the whole.',
    },
    {
      slug: 'averages-mean-median-mode',
      name: 'Averages: Mean, Median and Mode',
      description: 'Calculating and interpreting the mean, median and mode of a data set, and reasoning backwards from a given average to a missing value.',
      examLevelNotes: 'The Selective staple is the reverse mean: "the average of five scores is 24; four are known — find the fifth", solved via total = mean x count. Mastery means treating the mean through totals rather than the definition, ordering data before taking a median (the unordered-median error is a designed distractor), and handling even-count medians as the midpoint of the middle two. Questions also probe how adding a value moves the mean. Expect all three measures named precisely; students who conflate "average" with whichever measure is easiest will lose marks.',
    },
    {
      slug: 'two-step-data-problems',
      name: 'Two-Step Data Problems',
      description: 'Answering questions that require combining a read-off from a chart or table with a further calculation — a difference, rate, percentage or comparison.',
      examLevelNotes: 'This is the dominant Selective data format: the read-off is easy, the mark lives in the second step ("how much more", "what fraction of the total", "average speed between 11 am and 1 pm from the graph"). Mastery means explicitly separating the extraction step from the computation step, writing down intermediate values rather than holding them mentally. Errors overwhelmingly occur at the junction: a correct read-off fed into the wrong operation, or the right method applied to a misread value. Multi-question stimuli reward spending 20 seconds understanding the chart once, then answering three or four questions quickly.',
    },
  ],
  'time-zones': [
    {
      slug: 'time-zone-conversion',
      name: 'Time Zone Conversion',
      description: 'Converting a clock time in one city to the corresponding time in another given the hour (or half-hour) offset between them.',
      examLevelNotes: 'Direct form: "Perth is 3 hours behind Sydney; it is 2:15 pm in Sydney — what time is it in Perth?" Mastery means treating "ahead" as add and "behind" as subtract without hesitation, including half-hour offsets (Adelaide, India) and crossing midnight into the previous or next day. The universal trap is adding when subtraction is required — students should sanity-check with geography-free logic ("ahead means their clock shows a later time"). Fluency target: single conversions in 15 seconds, since conversion is usually step one of a longer problem.',
    },
    {
      slug: 'elapsed-time-across-zones',
      name: 'Elapsed Time Across Zones',
      description: 'Finding a true duration — typically a flight time — when departure and arrival are given in different local times.',
      examLevelNotes: 'The canonical Selective item: depart Frankfurt 11:35 am local, arrive Beijing 3:48 am next day local, Beijing 7 hours ahead — flight length? (Answer 9 h 13 min; this is a real past-paper question.) Mastery means converting both times into one zone before subtracting, and handling the "next day" wrap correctly. The designed trap is subtracting the local clock times directly, which is off by exactly the zone offset — and that wrong answer is always an option. Return-journey variants (the offset flips sign) test whether the method is understood or memorised.',
    },
    {
      slug: 'timetable-with-zones',
      name: 'Timetables with Time Zones',
      description: 'Combining timetable reading with time-zone conversion — connections, calls and broadcasts scheduled across cities in different zones.',
      examLevelNotes: 'These are three-layer problems: read the schedule, convert zones, then compute a duration or feasibility ("can she watch the 7 pm Sydney broadcast live if she is in Perth and finishes work at 4 pm?"). Mastery means a fixed pipeline — normalise everything to one zone first, then reason entirely within it. Errors compound: a single conversion slip poisons the final answer even when the timetable logic is right, so students should label every time with its city. These items are among the most time-expensive on the paper; a disciplined layout matters more than speed.',
    },
  ],
  'number-place-values': [
    {
      slug: 'place-value-comparison',
      name: 'Place Value Comparison',
      description: 'Identifying the value a digit represents by its position in large numbers, and comparing or combining those digit values.',
      examLevelNotes: 'The Selective form goes beyond naming a place: "in 9,738,124, multiply the value of the 8 by the value of the 2, then subtract the value of the 3" (a genuine past-paper structure requiring 8,000 x 20 - 30,000). Mastery means instantly reading a digit\'s value in numbers up to millions and then computing with those values accurately. The trap is using the digit instead of its value (8 rather than 8,000) at any step — one slip and the answer matches a distractor. Comma-grouping large numbers before starting eliminates most misreadings.',
    },
    {
      slug: 'ordering-decimals',
      name: 'Ordering Decimals',
      description: 'Placing decimals of different lengths in ascending or descending order by comparing digits place by place.',
      examLevelNotes: 'Tested directly and inside mixed sets (fractions and decimals together — see the fractions topic). Mastery means comparing place by place from the left after padding to equal length (0.4 vs 0.35 -> 0.40 vs 0.35). The core misconception is "longer means larger": ranking 0.35 above 0.4 because 35 > 4, and the option orderings are built around exactly this error. Questions often ask for the middle value or the second largest rather than the full order, so careful reading of which position is wanted matters as much as the comparison itself.',
    },
    {
      slug: 'rounding-decimals',
      name: 'Rounding Decimals',
      description: 'Rounding decimal numbers to the nearest whole, tenth or hundredth, and understanding what values could round to a given result.',
      examLevelNotes: 'Two forms: direct rounding (3.276 to one decimal place) and the reverse "which of these rounds to 5.3?" — the reverse form is harder and more Selective-typical, requiring the boundary interval 5.25 to 5.35. Mastery means looking only at the single digit to the right of the target place; students who scan further right ("round 3.249 up because of the 9") fall for a designed distractor. The half-way rule (5 rounds up) must be consistent. Boundary reasoning — knowing 5.25 rounds up but 5.2499 rounds down — separates the top band.',
    },
    {
      slug: 'powers-of-ten',
      name: 'Powers of Ten',
      description: 'Multiplying and dividing by 10, 100 and 1000 as digit shifts, and understanding how place value scales across metric and decimal contexts.',
      examLevelNotes: 'Rarely a headline question; it underlies metric conversion (64 mm = 6.4 cm appears inside a real perimeter item), decimal division, and large-number scaling. Mastery means shifting digits, not "adding zeros" — the adding-zeros heuristic breaks on decimals (3.5 x 10 is not 3.50) and that breakage is exactly what distractors target. Fluency both directions, including chained shifts (x 10 then / 1000), should be near-instant. Tutors should test with decimals rather than whole numbers, where the weakness actually shows.',
    },
    {
      slug: 'expanded-notation',
      name: 'Expanded Notation',
      description: 'Writing numbers as a sum of digit values (4,072 = 4000 + 70 + 2) and rebuilding numbers from expanded or scrambled expanded forms.',
      examLevelNotes: 'The Selective twist is the scrambled or irregular form: "which number equals 30,000 + 400 + 7 + 2,000?" (out of order) or expansions using multiplication (3 x 10,000 + 4 x 100). Mastery means handling missing places — the absent tens place must become a 0 in the digit string, and dropping that zero is the classic error the options are built around. Reverse questions (choose the correct expansion of 25,306) test the same zero-handling. This is quick-win territory: 30 seconds at most, with all errors coming from the empty-place slip.',
    },
  ],
  'multiples-and-factors': [
    {
      slug: 'finding-factors',
      name: 'Finding Factors',
      description: 'Listing all factors of a number systematically using factor pairs, and identifying common factors of two or more numbers.',
      examLevelNotes: 'Appears directly ("how many factors does 36 have?") and inside constraint puzzles — a real past-paper item requires numbers in a range with a factor of 13. Mastery means working in pairs from 1 upward and stopping at the square root, which guarantees completeness; unsystematic listing reliably misses one factor, and the count that is short by one or two is always an option. Square numbers (odd factor count because one pair repeats) are a favourite twist. Fluency target: all factors of any number up to 100 in about 30 seconds.',
    },
    {
      slug: 'finding-multiples',
      name: 'Finding Multiples',
      description: 'Generating multiples of a number and finding multiples that satisfy extra conditions — within a range, even or odd, or common to two numbers.',
      examLevelNotes: 'The Selective format layers constraints: "an odd number between 29 and 81 with a factor of 15" (a genuine past-paper condition, answer set 45 and 75). Mastery means generating multiples quickly and filtering against every stated condition — range endpoints, parity, digit conditions — rather than stopping at the first candidate. The typical error is satisfying some conditions and not re-checking the rest, especially whether range bounds are inclusive. Questions asking for a largest or smallest qualifying value require scanning the whole range, not just finding one answer.',
    },
    {
      slug: 'prime-composite',
      name: 'Prime and Composite Numbers',
      description: 'Distinguishing prime from composite numbers, recalling small primes instantly, and using prime factorisation in simple forms.',
      examLevelNotes: 'Expected knowledge: primes to at least 50 on instant recall, 1 is neither prime nor composite, and 2 is the only even prime — the last two facts are the most reliably tested misconceptions. Question forms include counting primes in a range, identifying a number from clues ("a prime between 40 and 50 whose digits sum to 7"), and simple prime-factor trees. Mastery means testing candidate primes by trial division only up to the square root. The distractor set almost always contains 51 or 91 (composite numbers that look prime), so those specific traps are worth rehearsing.',
    },
    {
      slug: 'divisibility-rules',
      name: 'Divisibility Rules',
      description: 'Applying quick tests for divisibility by 2, 3, 4, 5, 6, 8, 9 and 10 to classify numbers without performing the division.',
      examLevelNotes: 'Tested directly ("which of these is divisible by 6?") and as a speed tool inside remainder and factor questions — a real past-paper item asks which option leaves a different remainder when divided by 6, which divisibility sense accelerates greatly. Mastery means instant recall: digit-sum tests for 3 and 9, last-two-digits for 4, combined tests for 6 (both 2 and 3). The common failure is misremembering that the digit-sum test works for 3 and 9 only, wrongly extending it to 6 or 4. At 68 seconds a question, choosing the rule over long division is often the entire margin.',
    },
  ],
  fractions: [
    {
      slug: 'equivalent-fractions',
      name: 'Equivalent Fractions',
      description: 'Recognising and generating fractions of equal value by multiplying or dividing numerator and denominator by the same factor, including simplifying to lowest terms.',
      examLevelNotes: 'The gateway skill for the whole topic — comparison, arithmetic and probability questions all route through it. Mastery means two-way fluency (scale up to a target denominator; simplify down fully) and recognising families instantly: 3/4 = 6/8 = 75/100. The core error is adding the same number to top and bottom instead of multiplying, and partial simplification (12/18 -> 6/9 and stopping). Selective questions often disguise equivalence checks inside "which fraction does not belong?" formats. This must run at recall speed, not calculation speed.',
    },
    {
      slug: 'comparing-ordering-fractions',
      name: 'Comparing and Ordering Fractions',
      description: 'Ordering fractions — and mixed sets of fractions and decimals — using common denominators, decimal conversion or benchmark comparison.',
      examLevelNotes: 'The signature Selective item mixes representations: order 4/5, 1/3, 0.15, 1 1/5, 5/8, 0.40, 1.25 and identify the middle card (a genuine past-paper question). Mastery means converting everything to decimals — usually fastest — and knowing the standard conversions (eighths, thirds, fifths) by heart. Benchmark comparison (is it more or less than 1/2?) prunes options before precise work. Traps: the larger-denominator-means-larger error, and answering with the wrong position (the question wants the middle or second-smallest, not the smallest). Fluency with 1/8 = 0.125 and 1/3 = 0.33 is assumed.',
    },
    {
      slug: 'fraction-arithmetic',
      name: 'Fraction Arithmetic',
      description: 'Adding, subtracting, multiplying and dividing fractions, including unlike denominators and mixed numbers.',
      examLevelNotes: 'Addition/subtraction with unlike denominators is the core expectation (1/2 + 1/3 via sixths); multiplication of simple fractions and division by a whole number also appear, usually inside word problems rather than bare. Mastery means finding the least common denominator quickly and simplifying the result. The dominant error is adding numerators and denominators straight across (1/2 + 1/3 = 2/5) — a distractor in virtually every such question. Mixed numbers should be handled either by converting to improper fractions or by working parts separately; students need one reliable method, executed in under a minute.',
    },
    {
      slug: 'fractions-of-quantities',
      name: 'Fractions of Quantities',
      description: 'Finding a fraction of an amount (3/8 of 56) and reversing the process — recovering the whole from a known fractional part.',
      examLevelNotes: 'The reverse form is the Selective favourite: "the esky goes from 3/8 full to 3/4 full when 0.63 L is added — what is its capacity?" (a real past-paper item: 3/8 of the whole is 0.63 L, so one eighth is 0.21 L and the whole is 1.68 L). Mastery means the unitary method as a reflex — find the value of one part, scale to the whole — and comfort when the given amount corresponds to a difference of fractions rather than a single fraction. The forward direction (divide by denominator, multiply by numerator) should be automatic. The trap is treating the given quantity as the whole rather than the part.',
    },
    {
      slug: 'mixed-improper-conversion',
      name: 'Mixed and Improper Conversion',
      description: 'Converting between mixed numbers and improper fractions in both directions, and placing both forms on a number line.',
      examLevelNotes: 'A supporting skill that gates the harder fraction work: ordering tasks include values like 1 1/5 alongside 1.25 (as in the past-paper card question), and mixed-number arithmetic requires conversion first. Mastery means both directions at recall speed — whole times denominator plus numerator one way, division with remainder the other — in under ten seconds. Errors are mechanical: adding the whole to the numerator without multiplying, or writing the remainder over the original numerator instead of the denominator. Number-line placement questions check the conversion is understood, not just memorised.',
    },
    {
      slug: 'fraction-word-problems',
      name: 'Fraction Word Problems',
      description: 'Solving multi-step worded problems where quantities are described by fractions — parts remaining, successive fractions, and fraction-decimal mixtures.',
      examLevelNotes: 'The hardest fraction format: successive operations ("she spends 1/3 of her money, then 1/4 of what remains") where the second fraction applies to the new base, not the original — misapplying it to the original is the designed trap. Mastery means tracking the changing whole explicitly, often via the unitary method or by choosing a convenient total (say 12 units) and working concretely. Mixed fraction-decimal contexts (0.63 L filling 3/8 of a container) are standard. These items sit at the top of the difficulty range; a bar-model or units diagram is usually faster and safer than symbolic manipulation at this age.',
    },
  ],
  'lowest-common-multiple': [
    {
      slug: 'lcm-calculation',
      name: 'LCM Calculation',
      description: 'Finding the lowest common multiple of two or three numbers by listing multiples or using prime factors.',
      examLevelNotes: 'Bare LCM questions are quick marks; the skill must run fast because it is usually embedded in a word problem. Mastery means listing multiples of the largest number and testing the others against each — faster at this level than prime factorisation for the small numbers used (typically under 20). Three-number LCMs appear regularly (a past-paper item needs LCM of 2, 4 and 3). The critical distinction is LCM versus common multiple: any shared multiple is a distractor, only the lowest is right. Confusing LCM with HCF remains the top structural error.',
    },
    {
      slug: 'hcf-calculation',
      name: 'HCF Calculation',
      description: 'Finding the highest common factor of two or three numbers by listing factors or extracting shared prime factors.',
      examLevelNotes: 'Tested bare and inside splitting problems ("largest equal groups", "biggest square tile that fits both dimensions"). Mastery means systematic factor listing of the smaller number, then testing candidates against the larger, top down — the first shared factor found from the top is the answer. The two designed traps: giving a common factor that is not the highest, and swapping HCF for LCM when the word problem does not name the concept. Fluency with factor pairs (from the factors skill) is a prerequisite; students slow at factor listing cannot finish these in time.',
    },
    {
      slug: 'lcm-hcf-word-problems',
      name: 'LCM and HCF Word Problems',
      description: 'Recognising whether a worded situation calls for LCM or HCF, then solving — synchronised cycles, equal groupings, and repeating events.',
      examLevelNotes: 'The Selective classic is the synchronised-laps problem: three walkers with lap times of 2, 4 and 3 minutes (the last stated as "5 laps in 15 minutes", requiring a rate conversion first) meet again after LCM = 12 minutes — a genuine past-paper item. Mastery means classifying before computing: "when do cycles align?" is LCM; "largest equal split?" is HCF. Hidden preprocessing (converting rates to per-lap times) is where most marks are actually lost. The off-by-one trap in "how many times do they meet in an hour?" (counting the start or not) also recurs.',
    },
  ],
  algebra: [
    {
      slug: 'substitution',
      name: 'Substitution',
      description: 'Evaluating an expression or formula by replacing letters with given values, respecting order of operations.',
      examLevelNotes: 'Presented with words or letters: "if a = 5 and b = 3, find 2a + 4b" or evaluating a given real-world formula. Mastery means substituting with brackets around each value before simplifying, which prevents the dominant errors: treating 2a as 2 + a rather than 2 x a, and order-of-operations slips after substitution. Negative values are rare at this level but two-variable substitution is standard. This is a speed skill — 20 to 30 seconds — that also underpins checking answers in equation-solving questions, so it pays twice.',
    },
    {
      slug: 'solving-linear-equations',
      name: 'Solving Linear Equations',
      description: 'Finding the unknown in one- and two-step equations, including systems of two simple equations solved by substitution in sequence.',
      examLevelNotes: 'The Selective format often chains two equations: solve 5U - 45 = 15 for U, then feed U into 2R - U = 10 to find R, then report R + U (a genuine past-paper structure). Mastery means clean inverse-operation steps in the right order (undo addition before multiplication) and carrying the first result into the second equation without transcription slips. The question rarely asks for the variable itself — it asks for a sum, difference or product of the unknowns, and answering with just one variable\'s value is the built-in trap. Balance-scale intuition should be secure enough that formal notation never wobbles.',
    },
    {
      slug: 'forming-equations-from-words',
      name: 'Forming Equations from Words',
      description: 'Translating a worded relationship into an equation or ratio model — including "times as many", "more than", and part-whole ratio setups.',
      examLevelNotes: 'The canonical Selective item: "Wallace and Ela together weigh 147 kg; Wallace is twice as heavy — find the difference" (a real past-paper question, solved as 3 equal parts of 49 kg). Mastery means converting comparative language into parts or equations correctly: "twice as heavy as Ela" makes Wallace 2 parts, and reversing the comparison is the classic error. Multi-entity versions (four container colours linked by fraction and ratio relationships) appear at the hard end. At ages 10-12 the parts/units model usually beats formal algebra for speed and accuracy; the answer asked for is often a difference or percentage, not the base quantity.',
    },
    {
      slug: 'simplifying-expressions',
      name: 'Simplifying Expressions',
      description: 'Collecting like terms and simplifying simple algebraic expressions (3a + 2b + 4a = 7a + 2b).',
      examLevelNotes: 'The lightest-weight algebra skill on the paper, but a reliable mark: combine like terms, recognise that unlike terms (a and b, or a and a-squared-free constants) do not merge. The core error is exactly that merge — writing 3a + 2b as 5ab — and it anchors the distractor list. Perimeter expressions of labelled shapes ("a rectangle with sides x and x + 3") are the usual context, connecting to the perimeter topic. Mastery means 15-second execution with the coefficient-of-one case (a + 3a = 4a, not 3a) handled correctly.',
    },
  ],
  perimeter: [
    {
      slug: 'perimeter-rectilinear',
      name: 'Perimeter of Rectilinear Shapes',
      description: 'Calculating the perimeter of rectangles and L- or T-shaped figures made of right angles, including deducing unlabelled sides.',
      examLevelNotes: 'The rectangle case is quick recall (2 x (l + w)); the Selective value is in rectilinear shapes where opposite sides must balance — the sum of up-facing edges equals the sum of down-facing edges. Mastery includes the elegant shortcut that an L-shape\'s perimeter equals that of its bounding rectangle, which converts a six-side computation into two. The routine error is omitting one side from the total (the count of sides should be verified against the count of vertices). Unit discipline matters: a stray metre among centimetres is a standard trap.',
    },
    {
      slug: 'perimeter-composite-shapes',
      name: 'Perimeter of Composite Shapes',
      description: 'Finding the perimeter of complex shapes built from multiple pieces or with many labelled sides, including mixed units.',
      examLevelNotes: 'The past paper\'s hardest perimeter item (35% correct) sums eleven labelled sides with mixed units — 64 mm alongside 3.5 cm and 12 cm — so mastery is executional: convert every measurement to one unit first, then sum methodically, ticking each side off on the diagram. Internal edges where pieces join are not part of the boundary; including them is the conceptual trap. A second pass or grouping into friendly sums (pairs making 10) guards the long addition. These items are pure accuracy under tedium; encourage slow-is-fast discipline here and time recovery elsewhere.',
    },
    {
      slug: 'area-perimeter-relationship',
      name: 'Area and Perimeter Relationship',
      description: 'Reasoning about how area and perimeter relate and vary independently — rearranging pieces, fixed-area comparisons, and deriving one from the other.',
      examLevelNotes: 'The Selective form: a shape of 12 identical squares has area 48 cm² — the squares are rearranged into a new shape; find its perimeter (a real past-paper item: each square has side 2 cm, then count the new shape\'s edge segments). Mastery means understanding that rearrangement preserves area but changes perimeter, and being able to extract a unit length from an area. The central misconception — same area implies same perimeter — is precisely what these questions punish. Counting boundary segments on a grid figure accurately (interior edges excluded) is the executional half of the skill.',
    },
    {
      slug: 'missing-side-lengths',
      name: 'Missing Side Lengths',
      description: 'Deducing unlabelled sides of a figure from the labelled ones using opposite-side balance, symmetry, or a given perimeter.',
      examLevelNotes: 'Two forms: geometric deduction (in a rectilinear shape, the unlabelled horizontal side equals the total of opposite horizontals minus its partners) and algebraic (perimeter is 48 cm, five sides are known — find the sixth). Mastery means setting up the balance systematically instead of guessing from the diagram\'s look — Selective diagrams are deliberately drawn not-to-scale. The trap in the algebraic form is halving or doubling errors when the shape has paired equal sides marked with tick marks. This skill gates the composite-perimeter questions, where one missing side must be found before the sum can start.',
    },
  ],
  directions: [
    {
      slug: 'compass-directions',
      name: 'Compass Directions',
      description: 'Working with the eight compass points and the angles between them, and describing positions and movements using compass language.',
      examLevelNotes: 'Foundation facts: the eight points in order, 45 degrees between adjacent points, 90 between cardinal neighbours, and opposites (NE opposite SW). Question forms include "what direction is A from B?" on a marked map — where the reliable trap is answering the direction of B from A, the exact reverse. Mastery means anchoring North on the diagram first (it is occasionally rotated, which is signposted but missed under pressure). Inter-point angle recall must be instant because it feeds the turns-and-bearings skill.',
    },
    {
      slug: 'grid-references-maps',
      name: 'Grid References and Maps',
      description: 'Locating and describing positions on labelled grids and simple maps using coordinates or letter-number references, and tracing routes between cells.',
      examLevelNotes: 'Selective usage includes map questions and grid-pattern items (a past-paper pattern question answers in cell references like G3, H4, I2). Mastery means the across-then-up convention, kept straight even when the grid labels rows with numbers and columns with letters — the row/column swap is the dominant error and the swapped reference is always an option. Route questions add counting of moves between cells, where off-by-one on inclusive counting recurs. These are execution marks: nothing is conceptually hard, so accuracy under speed is the entire game.',
    },
    {
      slug: 'turns-and-bearings',
      name: 'Turns and Bearings',
      description: 'Tracking facing direction through sequences of quarter, half and fractional turns, clockwise and anticlockwise, from a given start.',
      examLevelNotes: 'The Selective classic: "facing North, he makes 3 half turns right, then 5 quarter turns left — what direction now?" (a real past-paper item; only half the cohort answered correctly). Mastery means reducing before tracking: 3 half turns = 1 half turn (full turns cancel), 5 quarter turns = 1 quarter turn, so the whole sequence collapses to two moves. Students who track all eight moves individually accumulate errors and burn a minute. Traps: left/right confusion under time pressure, and mixing the frame ("his right" versus the reader\'s right). Formal three-digit bearings are beyond scope, but "turn through 135 degrees" phrasing appears.',
    },
    {
      slug: 'relative-position-reasoning',
      name: 'Relative Position Reasoning',
      description: 'Deducing the arrangement of people or objects from relational clues — order in a line, distances between positions, and left/right relationships.',
      examLevelNotes: 'The exemplar is the five-friends problem: children in a line with clues about equal distances and multiplicative spacing, find the end-to-end distance (a real past-paper item at 46% correct — one of the harder questions). Mastery means drawing a line diagram immediately and placing constraints on it; attempting these mentally is the primary failure mode. Clues interlock, so the productive order is rarely the given order — scan for the most concrete clue first. Distance clues ("X sits 3 times further from A than from B") define ratios along the line and must not be misread as absolute distances.',
    },
  ],
  weight: [
    {
      slug: 'unit-conversion-mass',
      name: 'Unit Conversion: Mass',
      description: 'Converting between grams, kilograms and tonnes, and computing with masses expressed in mixed units.',
      examLevelNotes: 'The conversions (1000 g = 1 kg, 1000 kg = 1 t) must be digit-shift automatic, including decimal forms (0.45 kg = 450 g). Selective questions embed conversion inside comparison or arithmetic: totals of items given in mixed units, or "how many 250 g packs make 3 kg?" Mastery means converting to the smaller unit before computing, which avoids decimal slips. The standard trap is a factor-of-ten error in the shift (0.45 kg = 45 g), and the distractor list always includes it. Cross-links: the algebra topic\'s cargo problems use tonnes, so unit sense is assumed elsewhere.',
    },
    {
      slug: 'balance-scale-problems',
      name: 'Balance Scale Problems',
      description: 'Reasoning about equalities from balance-scale pictures or paired weighings — substituting one object for another and combining weighings to isolate an unknown.',
      examLevelNotes: 'The Selective exemplar is the three-object pairwise weighing: cube + pyramid = 569 g, sphere + cube = 227 g, pyramid + sphere = 520 g — total of all three? (A real past-paper item, solved by summing all three equations to get double the total: 1316 / 2 = 658 g.) Mastery means treating weighings as equations and spotting the sum-all-pairs trick, plus simple substitution when one balance shows equivalence (2 cubes = 3 spheres). The trap is grinding out each object individually, which works but costs triple the time. These items reward pattern recognition over computation.',
    },
    {
      slug: 'weight-word-problems',
      name: 'Weight Word Problems',
      description: 'Solving multi-step worded problems about mass — combined weights, differences, packaging and container-plus-contents reasoning.',
      examLevelNotes: 'Recurring structures: container-plus-contents ("the jar with jam weighs 890 g; half the jam is eaten and it weighs 530 g" — the jar-alone weight requires recognising the eaten half was 360 g), and combined-weighing puzzles like the two-people-on-a-scale ratio problem (147 kg total, one is twice the other — a past-paper item filed under algebra but posed in weight terms). Mastery means modelling before calculating: identify what each weighing includes. The container problem\'s designed trap is subtracting to get "the jam" when the difference is only half the jam. Unit consistency (g versus kg mid-problem) is the executional hazard.',
    },
  ],
  'speed-distance-time': [
    {
      slug: 'speed-formula-application',
      name: 'Speed Formula Application',
      description: 'Using the relationship speed = distance / time to find any one of the three quantities from the other two.',
      examLevelNotes: 'All three rearrangements are tested and must be reflexive: distance = speed x time, time = distance / speed. Selective questions use friendly numbers but non-unit times (2.5 hours, 40 minutes) so the real difficulty is time-as-decimal: 40 minutes is 2/3 hour, not 0.4 hour — that decimal error is the anchor distractor across the topic. Mastery means the triangle relationship applied without hesitation plus fraction-of-hour fluency. Answers should be sanity-checked against intuition (a cyclist does not travel 200 km in 2 hours).',
    },
    {
      slug: 'average-speed',
      name: 'Average Speed',
      description: 'Calculating average speed as total distance over total time, including from journeys with stops or from distance-time graphs.',
      examLevelNotes: 'The Selective form reads the inputs off a distance-time graph: "her overall average speed for the whole day" requires total distance travelled (summing every segment\'s movement, 48 km) over the full 8 hours = 6 km/h — a genuine past-paper item, and one of the paper\'s hardest (36% correct). Mastery means total-over-total always: never average the segment speeds, which is the canonical trap, and never exclude rest periods from the time unless the question says "while moving". Sub-interval variants ("between 11 am and 1 pm") test the same discipline over a slice of the graph.',
    },
    {
      slug: 'distance-time-conversion',
      name: 'Distance and Time Conversion',
      description: 'Converting units within speed problems — minutes to hours, metres to kilometres, and speeds between m/s-style and km/h-style ratios.',
      examLevelNotes: 'The unit-mismatch step is where speed questions are actually lost: a speed in km/h with a time in minutes, or a distance in metres. Mastery means normalising units before touching the formula, with fraction-of-hour conversion (15 min = 1/4 h, 40 min = 2/3 h) at recall speed. The designed trap is treating minutes as decimal hours (90 minutes as 1.9 hours). Full m/s to km/h conversion is at the edge of scope, but "metres per minute" to "kilometres per hour" scaling appears. Train the habit: write the units next to every number and cancel them like factors.',
    },
    {
      slug: 'speed-word-problems',
      name: 'Speed Word Problems',
      description: 'Solving multi-step motion problems — catch-up and meeting scenarios, journeys in stages, and combining rates from worded descriptions.',
      examLevelNotes: 'The Selective exemplar is the catch-up: Bri walks at 3 km/h, Humphrey jogs at 4 km/h from 2 km further away — he closes the gap at the relative speed of 1 km/h, so 2 hours (a real past-paper item at 39% correct). Mastery means the relative-speed insight — gap divided by speed difference — rather than simulating both walkers hour by hour, and staged-journey bookkeeping (each leg\'s distance and time tracked separately, then totalled). Traps: adding speeds when the question needs the difference (same direction) or vice versa (approaching), and mixing up who has the head start. These sit in the top difficulty band; a quick diagram of positions is the reliable entry move.',
    },
  ],
  rotation: [
    {
      slug: 'rotational-symmetry',
      name: 'Rotational Symmetry',
      description: 'Identifying whether a shape maps onto itself under rotation and stating its order of rotational symmetry.',
      examLevelNotes: 'Question forms: state the order of symmetry of a given figure, or pick which of five figures has order 4. Mastery means the counting convention — order is the number of matching positions in a full turn, so a square has order 4 and a figure with "no rotational symmetry" is said to have order 1. Confusing rotational symmetry with line (mirror) symmetry is the structural trap: the parallelogram (order 2, no mirror lines) and the equilateral-triangle family are the standard probes. Regular polygons\' order equals their side count; that shortcut is expected knowledge.',
    },
    {
      slug: 'rotating-shapes',
      name: 'Rotating Shapes',
      description: 'Visualising the image of a shape after rotation about a point — predicting orientation and position after quarter, half and three-quarter turns.',
      examLevelNotes: 'The exam shows a shape and asks which option is its image after a stated rotation, or which transformation maps left figure to right. Mastery means tracking one distinctive feature of the shape (a flag\'s tip, an L\'s foot) through the turn rather than the whole outline, and distinguishing rotation from reflection — the mirrored image is always among the options and is the top distractor. Clockwise/anticlockwise must be read carefully; a 90-degree clockwise image equals a 270-degree anticlockwise one, which options exploit. Centre-of-rotation off the shape (rotating about a corner or external point) is the hard variant.',
    },
    {
      slug: 'angle-of-rotation',
      name: 'Angle of Rotation',
      description: 'Determining the angle through which a shape has been rotated by comparing its before and after positions, in either direction.',
      examLevelNotes: 'The past-paper form shows a shape before and after and asks which angle could have produced the image, clockwise or anticlockwise (a real item: 135 degrees anticlockwise, equivalently 225 clockwise). Mastery means measuring the turn of one reference feature and knowing the two-direction equivalence — x degrees one way equals 360 - x the other — because options mix directions deliberately. Non-multiples of 90 (45, 135, 225) are standard, so eighth-turn estimation must be reliable. The trap is finding a correct-looking angle but in the direction the option does not state; both the angle and its direction must match.',
    },
  ],
};

export const WRITING_SKILLS: SkillSeed[] = [
  {
    slug: 'vocabulary',
    name: 'Vocabulary',
    description: 'The range, precision and ambition of word choice — selecting words that carry exact meaning and tone rather than the first word that comes to mind.',
    examLevelNotes: 'At Selective level, markers reward precise and natural word choice over decorative thesaurus insertions — "sauntered" used correctly beats "perambulated" used awkwardly. Mastery looks like varied verbs and specific nouns doing the descriptive work, with adjectives used sparingly, and vocabulary matched to the text type (technical clarity in a guide, evocative choices in a narrative). The common failure is over-reaching: long words misused, or the same strong word repeated until it deflates. Tutors should push for one-word-better substitutions in revision rather than adding more words.',
  },
  {
    slug: 'sentence-variety',
    name: 'Sentence Variety',
    description: 'Control over sentence length, structure and opening — mixing short and long, simple and complex sentences deliberately for rhythm and emphasis.',
    examLevelNotes: 'Selective markers can spot a one-pattern writer in three lines: every sentence subject-first and roughly the same length. Mastery looks like deliberate contrast — a string of longer sentences broken by a short one for impact — plus varied openers (adverbial, participial, subordinate-clause starts) used accurately. The failure modes are monotony at one end and run-ons at the other: ambitious compound-complex sentences that lose grammatical control cost more than they earn. In a roughly 30-minute writing task, two or three consciously varied moments per page is the realistic target.',
  },
  {
    slug: 'ideas',
    name: 'Ideas',
    description: 'The quality, originality and development of the content itself — what the piece says, how insightful or imaginative it is, and how fully each idea is developed.',
    examLevelNotes: 'This is the heaviest-weighted criterion in Selective writing marking: an original angle competently written outscores a clichéd story polished to a shine. Mastery looks like an unexpected interpretation of the prompt, one or two ideas developed deeply rather than five listed shallowly, and concrete specific detail over generic statement. The dominant weakness at ages 10-12 is the pre-prepared story shoehorned onto the prompt — markers are trained to spot it, and off-prompt writing is heavily penalised. Train idea generation under time: two minutes listing angles, pick the least obvious one that can still be sustained.',
  },
  {
    slug: 'text-structure',
    name: 'Text Structure',
    description: 'Organising the whole piece to match its text type — orientation to resolution in a narrative, position to reinforcement in a persuasive — with purposeful paragraphing.',
    examLevelNotes: 'The Selective task can demand any text type (narrative, persuasive, advice sheet, news report, diary), and the marker first checks the piece is structurally that type: a persuasive needs a stated position, developed arguments, and a conclusion that lands; a narrative needs a complication, not just events. Mastery looks like paragraphs each doing one job, an opening that commits to the form, and an ending written with intent rather than reached at time-out. The universal failure is the collapsed ending — strong start, rushed final third — so students should plan the ending first and budget minutes per section. A brief planning skeleton (four to five labels) measurably improves this criterion.',
  },
  {
    slug: 'punctuation-grammar',
    name: 'Punctuation and Grammar',
    description: 'Technical accuracy — sentence boundaries, agreement, tense consistency, and correct use of punctuation including dialogue punctuation and apostrophes.',
    examLevelNotes: 'Markers at this level expect full control of basics (capitals, full stops, question marks) and reward accurate use of the harder set: commas around embedded clauses, apostrophes of possession, and correctly punctuated dialogue with new-speaker-new-line. The highest-frequency faults in this age group are the comma splice, tense drift (past narration slipping into present), and its/it\'s. Mastery means errors rare enough not to interrupt a marker\'s reading — perfection is not required, but density matters. A two-minute proofread targeting sentence boundaries specifically catches the highest-value errors; students should be trained to reserve that time.',
  },
  {
    slug: 'audience',
    name: 'Audience',
    description: 'Awareness of who the writing is for — sustaining an appropriate register, tone and level of formality, and engaging the reader the text type implies.',
    examLevelNotes: 'Selective prompts frequently specify an audience (a letter to the principal, an advice sheet for younger students, a speech to an assembly), and matching register to that audience is scored directly. Mastery looks like consistent formality (no "gonna" in a formal letter, no stiff officialese in a diary), direct address used where the form invites it, and content selected for what that reader needs. The typical failure is drift — a formal opening decaying into chatty narration by paragraph three. Reading the piece back in the intended reader\'s voice is the fastest self-check; tutors should make the student name the audience aloud before writing a word.',
  },
  {
    slug: 'cohesion',
    name: 'Cohesion',
    description: 'How smoothly the writing flows as one connected piece — linking between sentences and paragraphs through connectives, pronoun reference and logical sequencing.',
    examLevelNotes: 'Cohesion is what makes a piece read as built rather than assembled: ideas in an order that needs no back-tracking, paragraph openings that pick up the previous thread, and pronouns whose referents are never ambiguous. Mastery at this level means a varied connective repertoire (however, meanwhile, despite this) deployed occasionally and accurately — the classic weakness is the "then... then... then" chain in narratives and "firstly/secondly/thirdly" scaffolding left bare in persuasives. Overused connectives read as padding; the strongest cohesion is often invisible, carried by echoed words and consistent point of view. Markers test it by ease of reading: if they must re-read a sentence to find what "it" refers to, the criterion drops.',
  },
];

export async function seedSkills(prisma: PrismaClient) {
  console.log('Seeding skill taxonomy...');

  let mathCount = 0;
  for (const [topicSlug, skills] of Object.entries(MATH_SKILLS)) {
    const topic = await prisma.mathTopic.findUnique({ where: { slug: topicSlug } });
    if (!topic) {
      console.error(`  ✗ MathTopic not found for skills: ${topicSlug}`);
      continue;
    }
    for (const s of skills) {
      await prisma.skill.upsert({
        where: { slug: s.slug },
        update: { subject: 'math', topicId: topic.id, name: s.name, description: s.description, examLevelNotes: s.examLevelNotes },
        create: { subject: 'math', topicId: topic.id, ...s },
      });
      mathCount++;
    }
    console.log(`  ✓ Skills: ${topicSlug} (${skills.length})`);
  }

  for (const s of WRITING_SKILLS) {
    await prisma.skill.upsert({
      where: { slug: s.slug },
      update: { subject: 'writing', topicId: null, name: s.name, description: s.description, examLevelNotes: s.examLevelNotes },
      create: { subject: 'writing', topicId: null, ...s },
    });
  }
  console.log(`  ✓ Skills: writing (${WRITING_SKILLS.length})`);

  console.log(`Skill taxonomy seed complete (${mathCount} math + ${WRITING_SKILLS.length} writing).`);
}
