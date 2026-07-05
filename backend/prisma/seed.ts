import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WRITING_TYPES = [
  {
    name: 'Advertisement',
    slug: 'advertisement',
    description: 'A persuasive text that promotes a product, service, or event using compelling language and visual elements to convince an audience to take action.',
    expectedStructure: 'Headline/attention-grabber, description of product/service, persuasive features/benefits, call to action',
    prompts: [
      'Create an advertisement for a new type of reusable water bottle that filters water as you drink.',
      'Design an advertisement for a community gardening program in your local neighbourhood.',
      'Write an advertisement for a "Book-Borrowing Café" where you can read while enjoying coffee.',
      'Create an advertisement for a new app that helps students organise their homework and study schedules.',
      'Design an advertisement for a school talent show fundraiser.'
    ]
  },
  {
    name: 'Advice Sheet',
    slug: 'advice-sheet',
    description: 'An instructional text that provides practical guidance, tips, and recommendations on a specific topic to help the reader achieve a goal or solve a problem.',
    expectedStructure: 'Title/heading, introduction stating the purpose, numbered or bulleted tips/advice, conclusion or final encouragement',
    prompts: [
      'Write an advice sheet for students starting at a new school, offering tips on how to settle in and make friends.',
      'Create an advice sheet titled "How to Prepare for a Big Test" aimed at Year 6 students.',
      'Write an advice sheet for young children on how to stay safe when walking to school alone.',
      'Create an advice sheet for someone who wants to start a small vegetable garden at home.',
      'Write an advice sheet on how to manage screen time and develop healthy digital habits.'
    ]
  },
  {
    name: 'Diary Entry',
    slug: 'diary-entry',
    description: 'A personal, reflective text written in first person that records experiences, thoughts, and feelings about events from the writer\'s perspective.',
    expectedStructure: 'Date/salutation, description of events in chronological order, personal reflections and feelings, closing thought',
    prompts: [
      'Write a diary entry about the day you discovered a hidden talent you never knew you had.',
      'Write a diary entry from the perspective of a child who just moved to Australia from another country on their first day of school.',
      'Write a diary entry about a day when everything went wrong — but ended up being surprisingly wonderful.',
      'Write a diary entry from the perspective of an astronaut who just stepped onto Mars for the first time.',
      'Write a diary entry about the day your family adopted a pet from the animal shelter.'
    ]
  },
  {
    name: 'Discussion',
    slug: 'discussion',
    description: 'A balanced text that explores multiple perspectives on an issue, presenting arguments for and against before reaching a reasoned conclusion.',
    expectedStructure: 'Introduction stating the issue, arguments for (with evidence), arguments against (with evidence), balanced conclusion',
    prompts: [
      'Discuss whether all students should be required to learn a second language at school.',
      'Discuss the pros and cons of having a four-day school week with longer hours each day.',
      'Discuss whether homework should be banned in primary schools.',
      'Discuss the benefits and drawbacks of social media for young people.',
      'Discuss whether schools should replace traditional books with tablets and laptops.'
    ]
  },
  {
    name: 'Guide',
    slug: 'guide',
    description: 'A how-to text that explains a process or system, providing clear instructions and useful information to help the reader navigate or accomplish something.',
    expectedStructure: 'Title and introduction, step-by-step instructions or sections, tips and warnings, summary or next steps',
    prompts: [
      'Write a guide for international visitors on how to use Sydney\'s public transport system.',
      'Create a guide for young students on how to organise a successful fundraising event at school.',
      'Write a guide titled "How to Build a Worm Farm" for a school environmental club.',
      'Create a guide for new school library monitors on how to run the library during lunch breaks.',
      'Write a guide for students on how to prepare and present a compelling oral presentation.'
    ]
  },
  {
    name: 'Letter',
    slug: 'letter',
    description: 'A formal or informal written correspondence addressing a specific person or organisation to convey information, request action, or express views.',
    expectedStructure: 'Salutation, introduction stating purpose, body paragraphs with details, closing and signature',
    prompts: [
      'Write a letter to the principal arguing for a new outdoor play area or sports facility at your school.',
      'Write a letter to a local newspaper expressing your views on whether kids should have more say in community decisions.',
      'Write a letter to a pen pal in another country describing what life is like in your Australian town or city.',
      'Write a letter to a favourite author telling them how their book influenced you and asking a question about their writing.',
      'Write a letter to your future self to be opened in ten years, describing your hopes and dreams.'
    ]
  },
  {
    name: 'Narrative/Creative',
    slug: 'narrative-creative',
    description: 'A fictional or semi-fictional story that engages the reader through character, setting, plot, and descriptive language to entertain or convey a message.',
    expectedStructure: 'Orientation (character/setting), complication/conflict, rising action, climax, resolution',
    prompts: [
      'Write a story that begins with the sentence: "The moment I opened the door, I knew nothing would ever be the same again."',
      'Write a story about a child who discovers a mysterious map hidden inside an old book at the library.',
      'Write a story about a friendship that forms between two very different people during a school camping trip.',
      'Write a story set in a world where the sun never sets, and one day it suddenly begins to get dark.',
      'Write a story about a young person who must overcome a fear to help someone else in need.'
    ]
  },
  {
    name: 'News Report',
    slug: 'news-report',
    description: 'A factual account of a recent event written in journalistic style, providing key information about who, what, where, when, why, and how.',
    expectedStructure: 'Headline, byline/dateline, lead paragraph (5 Ws), body with details, quotes from witnesses/experts, closing paragraph',
    prompts: [
      'Write a news report about a local community that came together to save a historic building from demolition.',
      'Write a news report about a school\'s environmental initiative that has inspired other schools across the state.',
      'Write a news report about a young inventor who created a device to help clean up ocean plastic.',
      'Write a news report about a major sporting event where an underdog team achieved an unexpected victory.',
      'Write a news report about a rare natural phenomenon that was visible in your town last night.'
    ]
  },
  {
    name: 'Persuasive',
    slug: 'persuasive',
    description: 'A text that aims to convince the reader to adopt a particular viewpoint or take a specific action through reasoned argument and rhetorical devices.',
    expectedStructure: 'Introduction with thesis statement, arguments with supporting evidence (each in its own paragraph), counter-argument and rebuttal, strong conclusion',
    prompts: [
      'Argue for or against the idea that every school should have a student-run newspaper or media club.',
      'Persuade your local council to build a new skate park or youth recreation centre in your area.',
      'Argue whether Australia should do more to protect its native wildlife from extinction.',
      'Persuade your school to introduce a "no homework on weekends" policy.',
      'Argue whether kids should be allowed to have their own mobile phones before high school.'
    ]
  },
  {
    name: 'Review',
    slug: 'review',
    description: 'A critical evaluation of a product, service, experience, or creative work that provides an opinion supported by evidence and a recommendation.',
    expectedStructure: 'Introduction naming what is reviewed, overall impression, specific aspects evaluated (with evidence), rating, recommendation',
    prompts: [
      'Write a review of a book you have read recently, discussing its plot, characters, and whether you would recommend it.',
      'Write a review of a new restaurant or café in your area, covering the food, service, atmosphere, and value for money.',
      'Write a review of a video game or app that you enjoy, discussing its gameplay, graphics, and replay value.',
      'Write a review of a movie or TV show you watched recently, evaluating the story, acting, and production quality.',
      'Write a review of a museum exhibit or gallery you visited on a school excursion.'
    ]
  },
  {
    name: 'Speech',
    slug: 'speech',
    description: 'A text written to be delivered orally to an audience, using rhetorical devices and persuasive language to inform, inspire, or persuade listeners.',
    expectedStructure: 'Greeting/acknowledgment of audience, introduction with hook, body with key points, rhetorical devices, memorable conclusion',
    prompts: [
      'Write a speech for school captain arguing that "kindness is the most important quality a leader can have."',
      'Write a speech to deliver at a school assembly about why your school should participate in a national tree-planting day.',
      'Write a speech for a debate arguing that "technology brings people closer together."',
      'Write a speech to welcome new students to your school, helping them feel excited and supported.',
      'Write a speech for a fundraising event to support a cause you care deeply about.'
    ]
  }
];

async function main() {
  console.log('Seeding database...');

  for (const wt of WRITING_TYPES) {
    const { prompts, ...typeData } = wt;
    const created = await prisma.writingType.upsert({
      where: { slug: typeData.slug },
      update: typeData,
      create: typeData,
    });

    await prisma.prompt.deleteMany({ where: { typeId: created.id } });

    for (const promptText of prompts) {
      await prisma.prompt.create({
        data: {
          text: promptText,
          typeId: created.id,
        },
      });
    }

    console.log(`  ✓ ${typeData.name} (${prompts.length} prompts)`);
  }

  console.log('Seed complete.');
}

// ── Mathematics Seed Data ────────────────────────────────────────────────────

const MATH_TOPICS = [
  { name: 'Number Sentences', slug: 'number-sentences', description: 'Translating word problems into number sentences and equations.' },
  { name: 'Probability', slug: 'probability', description: 'Calculating likelihood of events and understanding probability concepts.' },
  { name: 'Combinations', slug: 'combinations', description: 'Counting possible combinations and arrangements of items.' },
  { name: 'Arithmetic', slug: 'arithmetic', description: 'Basic operations, remainders, and multi-step word problems.' },
  { name: 'Patterns', slug: 'patterns', description: 'Identifying and extending number patterns and sequences.' },
  { name: 'Protractor Skills', slug: 'protractor-skills', description: 'Reading and interpreting angles using a protractor.' },
  { name: 'Time', slug: 'time', description: 'Calculating elapsed time, schedules, and planning.' },
  { name: 'Magic Squares', slug: 'magic-squares', description: 'Solving magic square puzzles with missing numbers.' },
  { name: 'Data Interpretation', slug: 'data-interpretation', description: 'Reading and interpreting tables, pie charts, and graphs.' },
  { name: 'Time Zones', slug: 'time-zones', description: 'Calculating time differences across time zones.' },
  { name: 'Number Place Values', slug: 'number-place-values', description: 'Understanding place value and digit values in numbers.' },
  { name: 'Multiples and Factors', slug: 'multiples-and-factors', description: 'Working with multiples, factors, and divisibility.' },
  { name: 'Fractions', slug: 'fractions', description: 'Comparing, converting, and calculating with fractions and decimals.' },
  { name: 'Lowest Common Multiple', slug: 'lowest-common-multiple', description: 'Finding LCM and solving problems involving repeated cycles.' },
  { name: 'Algebra', slug: 'algebra', description: 'Solving equations with variables and unknown values.' },
  { name: 'Perimeter', slug: 'perimeter', description: 'Calculating perimeter of shapes with given measurements.' },
  { name: 'Directions', slug: 'directions', description: 'Understanding compass directions and turns.' },
  { name: 'Weight', slug: 'weight', description: 'Solving problems involving weight and balance.' },
  { name: 'Speed, Distance, Time', slug: 'speed-distance-time', description: 'Calculating speed, distance, and time relationships.' },
  { name: 'Rotation', slug: 'rotation', description: 'Understanding rotation of shapes and angles of rotation.' },
];

interface MathQSeed {
  topicSlug: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  percentCorrect: number;
  stimulusGroup?: string;
}

const MATH_QUESTIONS: MathQSeed[] = [
  {
    topicSlug: 'number-sentences',
    questionText: 'When a total of 238 blueberries are shared between 22 people, each person receives 10 blueberries with 18 blueberries leftover. Which of the following number sentences shows the information above?',
    options: ['22 × 10 + 18 = 238', '22 + 10 + 18 = 238', '22 + 10 × 18 = 238', '22 × 10 − 18 = 238', '22 − 10 × 18 = 238'],
    correctIndex: 0,
    explanation: '"22 people, each person receives 10 blueberries": 22 × 10. "with 18 blueberries leftover": +18. "When a total of 238 blueberries are shared": = 238. Combine: 22 × 10 + 18 = 238. Therefore, the answer is Option A.',
    percentCorrect: 94.60,
  },
  {
    topicSlug: 'probability',
    questionText: 'A bag contains pink, yellow, and red marbles. There are 60 marbles in total. If the pink marbles were taken out, the probability of picking a yellow marble is 75%. There are a total of 16 pink marbles. How many red marbles are in the bag?',
    options: ['11', '22', '33', '35', '49'],
    correctIndex: 0,
    explanation: 'Since there are a total of 16 pink marbles, if the pink marbles were taken out, there would be 60 – 16 = 44 yellow and red marbles. If the pink marbles were taken out, the probability of picking a yellow marble is 75%, meaning there are 0.75 × 44 marbles = 33 yellow marbles. This leaves 44 – 33 = 11 red marbles. Therefore, the answer is Option A.',
    percentCorrect: 76.09,
  },
  {
    topicSlug: 'combinations',
    questionText: 'At a frozen yoghurt store, each order must have a flavour of yoghurt, a sugary topping and a fruity topping. At this particular store, there are a total of 9 different yoghurt flavours, 18 different sugary toppings and 5 different fruity toppings. How many different combinations of frozen yoghurt orders are possible?',
    options: ['162', '540', '675', '728', '810'],
    correctIndex: 4,
    explanation: 'Different combinations = 9 yoghurt flavours × 18 sugary toppings × 5 fruity toppings = 810 different combinations of frozen yoghurt orders. Therefore, the answer is Option E.',
    percentCorrect: 82.01,
  },
  {
    topicSlug: 'arithmetic',
    questionText: 'Which of the following answer options has a different remainder when divided by 6?',
    options: ['58', '40', '44', '22', '46'],
    correctIndex: 2,
    explanation: '(a) 58 ÷ 6 = 9 remainder 4. (b) 40 ÷ 6 = 6 remainder 4. (c) 44 ÷ 6 = 7 remainder 2 (different remainder). (d) 22 ÷ 6 = 3 remainder 4. (e) 46 ÷ 6 = 7 remainder 4. Therefore, the answer is Option C.',
    percentCorrect: 80.98,
  },
  {
    topicSlug: 'patterns',
    questionText: 'Find the missing value, represented by X, in the number pattern below.\n\n3, 10, X, 94, 283, 850',
    options: ['17', '19', '31', '37', '45'],
    correctIndex: 2,
    explanation: 'Pattern is to multiply the previous number by 3 and add 1.\n3 × 3 + 1 = 10\n10 × 3 + 1 = 31\n31 × 3 + 1 = 94\n94 × 3 + 1 = 283\n283 × 3 + 1 = 850\nTherefore, the answer is Option C.',
    percentCorrect: 69.92,
  },
  {
    topicSlug: 'protractor-skills',
    questionText: 'Tim has cut out a section from the following circle. Tim wants to know the size of the larger angle in the centre of the circle by first measuring the size of the smaller angle in the centre of the circle. Using the protractor provided, what is the size of the larger angle?',
    options: ['15°', '100°', '115°', '245°', '260°'],
    correctIndex: 4,
    explanation: 'The size of the smaller angle as shown on the protractor is 115° − 15° = 100°. Since a full circle is 360°, the size of the larger angle must be 360° − 100° = 260°. Therefore, the answer is Option E.',
    percentCorrect: 66.32,
  },
  {
    topicSlug: 'arithmetic',
    questionText: 'Cinar, Paula and Sophie share a box of strawberries and finish the whole thing. Cinar eats half the number of strawberries that Paula and Sophie eat together. Paula eats 4 more than 3 times the number of strawberries that Sophie eats. If Sophie ate 6 strawberries, how many strawberries are in the box?',
    options: ['28', '42', '56', '60', '74'],
    correctIndex: 1,
    explanation: 'If Sophie ate 6 strawberries, then Paula ate (6 × 3) + 4 = 22 strawberries. Together, Sophie and Paula ate 6 + 22 = 28 strawberries, meaning Cinar must have eaten 28 ÷ 2 = 14 strawberries. Hence, there must have been 6 + 22 + 14 = 42 strawberries in the box. Therefore, the answer is Option B.',
    percentCorrect: 87.15,
  },
  {
    topicSlug: 'algebra',
    questionText: 'The following equations use the letters R and U to represent different numbers.\n\n2R − U = 10\n5U − 45 = 15\n\nWhat is the sum of R and U?',
    options: ['16', '23', '29', '34', '45'],
    correctIndex: 1,
    explanation: '5U − 45 = 15\n5U = 15 + 45 = 60\n5U = 60 → U = 60 ÷ 5 = 12\nSince we now know U = 12:\n2R − U = 10\n2R − 12 = 10\n2R = 22 → R = 22 ÷ 2 = 11\nThus, R + U = 12 + 11 = 23.\nTherefore, the answer is Option B.',
    percentCorrect: 69.41,
  },
  {
    topicSlug: 'time',
    questionText: 'Kim is planning the commute so that he arrives at his workplace at 8:55 am. It takes Kim between 15 to 33 minutes to prepare his lunch and 8 minutes to lock up his house. Then Kim hires a private car that takes between 45 minutes to 1.5 hours to drive to Kim\'s workplace. What is the latest time that Kim should start to prepare to leave his house to ensure that he arrives at his workplace on time?',
    options: ['6:44 am', '6:53 am', '6:59 am', '7:12 am', '7:18 am'],
    correctIndex: 0,
    explanation: 'To determine the latest time that Kim should start to prepare to leave his house, we should assume that it takes Kim 33 minutes to prepare his lunch and 1.5 hours to drive to his workplace. In total, it takes Kim 33 minutes + 8 minutes + 1.5 hours = 131 minutes (2 hrs 11 mins) to arrive at his workplace from the time he starts preparing to leave the house. Thus, Kim must leave his house at 8:55 am – 2hrs 11 mins = 6:44 am at the latest. Therefore, the answer is Option A.',
    percentCorrect: 61.18,
  },
  {
    topicSlug: 'magic-squares',
    questionText: 'In a magic square, each row, column and diagonal add up to the same total. Some of the numbers are missing in the magic square below.\n\n|   |   | 13 |\n|   | 12 | ?  |\n| 11 | 16 |    |\n\nWhat is the missing number?',
    options: ['14', '15', '17', '19', '21'],
    correctIndex: 0,
    explanation: '11 + 12 + 13 = 36, so the total of each row, column, and diagonal must add up to 36. Bottom row, right column: 36 − (11 + 16) = 9. Middle row, right column (?): 36 − (13 + 9) = 14. Therefore, the answer is Option A.',
    percentCorrect: 85.60,
  },
  {
    topicSlug: 'data-interpretation',
    questionText: 'John wants to go to the printing shop to print some documents. The prices at the shop are shown below:\n\n| Size   | 10-pack | 15-pack | 30-pack |\n|--------|---------|---------|---------|\n| Small  | $6      | $9      | $16     |\n| Medium | $10     | $15     | $28     |\n| Large  | $14     | $21     | $40     |\n\nWhat is the cheapest it will cost John if he wishes to print 12 documents in size large?',
    options: ['$20', '$21', '$26', '$30', '$35'],
    correctIndex: 1,
    explanation: 'To find the cheapest way for John to print 12 large-sized documents, we need to compare the pack options and prices from the table. For the 12 large documents, the cheapest option is to buy a 15-pack for $21. This gives him slightly more than needed, but it is still cheaper than combining two 10-packs or buying a 30-pack. Therefore, the answer is Option B.',
    percentCorrect: 82.52,
  },
  {
    topicSlug: 'time-zones',
    questionText: 'Eugene is travelling from Frankfurt, Germany to Beijing, China. Eugene departs from Frankfurt at 11:35 am local time and arrives at Beijing at 3:48 am the next day local time. If Beijing is 7 hours ahead of Germany, how long is Eugene\'s flight?',
    options: ['8 hours 45 minutes', '8 hours 57 minutes', '9 hours 6 minutes', '9 hours 13 minutes', '9 hours 23 minutes'],
    correctIndex: 3,
    explanation: 'Frankfurt, Germany: 11:35 am → Beijing time: 11:35 am + 7 hours = 6:35 pm. Arrival: 3:48 am next day. Flight duration: 3:48 am next day − 6:35 pm = 9 hours 13 minutes. Therefore, the answer is Option D.',
    percentCorrect: 75.06,
  },
  {
    topicSlug: 'patterns',
    questionText: 'Ela is decorating the concrete pavement outside her house. Ela starts by placing tiles in column A in a pattern. The pattern continues towards the right.\n\nWhich of the following options are the coordinates of the next 3 black tiles?',
    options: ['G2, H3, I4', 'G3, H4, I1', 'G3, H4, I2', 'G4, H2, I3', 'G1, H3, I2'],
    correctIndex: 2,
    explanation: 'The next 3 black tiles are in G3, H4, I2. Therefore, the answer is Option C.',
    percentCorrect: 77.89,
  },
  {
    topicSlug: 'number-place-values',
    questionText: 'The place value of digits in a number represents different values. For example, the 3 in 238 represents 30. In the number 9,738,124 what is the value represented by 8 multiplied by the value represented by 2, minus the value represented by 3?',
    options: ['105,000', '110,000', '117,000', '125,000', '130,000'],
    correctIndex: 4,
    explanation: 'Value of 8 in 9,738,124 = 8,000. Value of 2 in 9,738,124 = 20. Value of 3 in 9,738,124 = 30,000. (8,000 × 20) − 30,000 = 130,000. Therefore, the answer is Option E.',
    percentCorrect: 83.03,
  },
  {
    topicSlug: 'multiples-and-factors',
    questionText: 'Hana and Connor are thinking of different whole numbers greater than 29 and less than 81. Hana\'s number is an even number and has a factor of 13. Connor\'s number is an odd number and has a factor of 15. What is the sum of the largest possible value of Hana\'s number and the smallest possible value of Connor\'s number?',
    options: ['123', '138', '145', '152', '176'],
    correctIndex: 0,
    explanation: 'List of Hana\'s possible numbers: 52, 78. List of Connor\'s possible numbers: 45, 75. Largest possible value of Hana\'s number: 78. Smallest possible value of Connor\'s number: 45. Sum: 78 + 45 = 123. Therefore, the answer is Option A.',
    percentCorrect: 67.87,
  },
  {
    topicSlug: 'arithmetic',
    questionText: 'Five friends are sitting at the playground in a straight line in the following order: Yuvraj, Keeley, Harleen, Jovan, Esmay.\n\nThe distance between Yuvraj and Keeley is the same as the distance between Harleen and Esmay.\nHarleen sits 3 times further away from Esmay than she sits from Keeley.\nJovan sits at a spot that is equal distance from Harleen and Esmay.\n\nIf the distance between Harleen and Jovan is 10.5m, and the distance between Keeley and Harleen is 7m, what is the distance between Yuvraj and Esmay?',
    options: ['36 m', '49 m', '53 m', '56 m', '61 m'],
    correctIndex: 1,
    explanation: 'If the distance between Harleen and Jovan is 10.5m, then the distance between Jovan and Esmay must also be 10.5m because Jovan sits at a spot that is equal distance from Harleen and Esmay. Since the distance between Harleen and Esmay is 10.5 + 10.5 = 21m, the distance between Yuvraj and Keeley must also be 21m. We know that the distance between Harleen and Keeley = 7m. Thus, the distance between Yuvraj and Esmay is 21 + 7 + 21 = 49m. Therefore, the answer is Option B.',
    percentCorrect: 45.76,
  },
  {
    topicSlug: 'fractions',
    questionText: 'Shona has the following cards with a mix of fractions and decimals on them:\n\n4/5, 1/3, 0.15, 1 1/5, 5/8, 0.40, 1.25\n\nShona arranges the cards in ascending order, increasing from left to right. Which fraction or decimal is on the middle card?',
    options: ['4/5', '1/3', '0.15', '5/8', '0.40'],
    correctIndex: 3,
    explanation: 'Convert all fractions to decimals: 4/5 = 0.80, 1/3 = 0.33, 5/8 = 0.625, 1 1/5 = 1.20. Ascending order: 0.15, 0.33, 0.40, 0.625, 0.80, 1.20, 1.25. The middle number is 0.625 = 5/8. Therefore, the answer is Option D.',
    percentCorrect: 58.35,
  },
  {
    topicSlug: 'lowest-common-multiple',
    questionText: 'Sharna, Ella and Wade walk laps around their local park. They all have consistent lap times. Sharna completes a lap every 2 minutes. Ella completes a lap every 4 minutes. Wade completes 5 laps every 15 minutes. He takes the same amount of time to complete each lap. If Sharna, Ella, and Wade all start their first lap at the same time, how many minutes will pass before they meet at the starting line again?',
    options: ['13.5 minutes', '12 minutes', '15 minutes', '18 minutes', '20 minutes'],
    correctIndex: 1,
    explanation: 'Sharna: 1 lap every 2 minutes. Ella: 1 lap every 4 minutes. Wade: 5 laps every 15 minutes = 1 lap every 3 minutes. The lowest common multiple of 2, 4, and 3 is 12. Thus, 12 minutes will pass before they meet at the starting line again. Therefore, the answer is Option B.',
    percentCorrect: 74.55,
  },
  {
    topicSlug: 'algebra',
    questionText: 'Wallace and Ela weigh themselves together and the scale shows a reading of 147 kg. Wallace knows that he is 2 times heavier than Ela. What is the difference between Wallace and Ela\'s weight?',
    options: ['38 kg', '44 kg', '47 kg', '48 kg', '49 kg'],
    correctIndex: 4,
    explanation: 'Wallace is 2 times heavier than Ela, so their weight ratio is: Wallace : Ela → 2 : 1. In total, there are 2 + 1 = 3 parts. 1 part = 147 kg ÷ 3 = 49 kg. 2 parts = 49 kg × 2 = 98 kg (Wallace\'s weight). 1 part = 49 kg (Ela\'s weight). Difference = 98 − 49 = 49 kg. Therefore, the answer is Option E.',
    percentCorrect: 65.81,
  },
  {
    topicSlug: 'perimeter',
    questionText: 'Find the perimeter of the grey shape below.\n\nNote: 64 mm = 6.4 cm, 30 mm = 3.0 cm.\n\nThe shape has the following measurements: 12 cm, 12 cm, 12 cm, 3.5 cm, 6.4 cm, 3.0 cm, 6.4 cm, 6.4 cm, 3.0 cm, 6.4 cm, 3.5 cm.',
    options: ['74.6 cm', '86.8 cm', '92.3 cm', '94.6 cm', '102.3 cm'],
    correctIndex: 0,
    explanation: 'Convert mm to cm: 64 mm = 6.4 cm, 30 mm = 3.0 cm. Perimeter = 12 + 12 + 12 + 3.5 + 6.4 + 3.0 + 6.4 + 6.4 + 3.0 + 6.4 + 3.5 = 74.6 cm. Therefore, the answer is Option A.',
    percentCorrect: 35.22,
  },
  {
    topicSlug: 'directions',
    questionText: 'Chris is standing in a playground that has a compass drawn on the ground. He is facing North.\n\nHe makes 3 half turns to his right.\nHe makes another 5 quarter turns to his left.\n\nWhat direction is he facing now?',
    options: ['North', 'North-East', 'South-West', 'West', 'East'],
    correctIndex: 4,
    explanation: 'He starts at North. 3 half turns clockwise = 1 half turn clockwise → He faces South. 5 quarter turns anticlockwise = 1 quarter turn anticlockwise → He faces East. Therefore, the answer is Option E.',
    percentCorrect: 50.13,
  },
  {
    topicSlug: 'weight',
    questionText: 'Mandy is measuring the weight of three different objects: a cube, a pyramid, and a sphere. The scale is faulty, and 2 items must be placed on the scale at one time. The following information is known:\n\nThe cube and pyramid weigh 569g together.\nThe sphere and cube weigh 227g together.\nThe pyramid and sphere weigh 520g together.\n\nWhat is the total weight of the cube, pyramid, and sphere?',
    options: ['632 g', '658 g', '692 g', '728 g', '744 g'],
    correctIndex: 1,
    explanation: 'Cube + Pyramid = 569 g. Sphere + Cube = 227 g. Pyramid + Sphere = 520 g. Adding all: 2(Cube + Pyramid + Sphere) = 569 + 227 + 520 = 1316 g. So Cube + Pyramid + Sphere = 1316 ÷ 2 = 658 g. Therefore, the answer is Option B.',
    percentCorrect: 44.99,
  },
  {
    topicSlug: 'data-interpretation',
    questionText: 'Jeremy is writing up a budget for his business expenses. A pie chart shows how much money he dedicates to each expense:\n\nRent: $27,000\nElectricity: $13,000\nTaxes: $34,000\nOverhead: ?\n\nWhich of the following could replace the question mark for Overhead?',
    options: ['8', '12', '23', '37', '42'],
    correctIndex: 2,
    explanation: 'Total of known values: 27 + 13 + 34 = 74. Based on the visual size of the Overhead slice (almost a third of the pie), 23 seems most reasonable, as it brings the total close to 100 and the portion size fits well with the visual. Therefore, the answer is Option C.',
    percentCorrect: 67.35,
  },
  {
    topicSlug: 'arithmetic',
    questionText: 'Alex has written down his recipe for a chocolate milkshake below:\n\n- 250 mL of milk\n- 150 mL of chocolate syrup\n- 100 g of ice cream\n- 20 mL of sugar syrup\n\nThe recipe makes 1.5 servings of chocolate milkshake.\n\nIf Alex wants to make 25 servings of chocolate milkshake, how much chocolate syrup does Alex need?',
    options: ['1.9 L', '2.1 L', '2.3 L', '2.5 L', '2.7 L'],
    correctIndex: 3,
    explanation: 'If 1.5 servings require 150 mL of chocolate syrup, then 1 serving requires 150 ÷ 1.5 = 100 mL. Thus, 25 servings require 100 × 25 = 2500 mL or 2.5 L of chocolate syrup. Therefore, the answer is Option D.',
    percentCorrect: 47.04,
  },
  {
    topicSlug: 'speed-distance-time',
    questionText: 'How many kilometres did Hettie travel in total between 9 am to 12 pm?',
    options: ['12 km', '14 km', '16 km', '18 km', '20 km'],
    correctIndex: 0,
    explanation: 'From 9 am to 12 pm, Hettie travelled 2 + 10 = 12 km. Therefore, the answer is Option A.',
    percentCorrect: 34.70,
    stimulusGroup: 'The following line graph details the time and distance that Hettie travels by bicycle in a day. The graph shows distance travelled (km) on the y-axis and time of day on the x-axis from 9 am to 5 pm. Key points: at 9 am distance = 0 km, at 10 am distance = 2 km, at 11 am distance = 2 km, at 12 pm distance = 12 km, at 1 pm distance = 20 km, at 2 pm distance = 32 km, at 3 pm distance = 40 km, at 4 pm distance = 40 km, at 5 pm distance = 48 km.',
  },
  {
    topicSlug: 'speed-distance-time',
    questionText: 'How long did Hettie have her bicycle stationary throughout the day?',
    options: ['1 hour', '2 hours', '2.5 hours', '4 hours', '4.5 hours'],
    correctIndex: 1,
    explanation: 'Time when Hettie\'s bicycle was stationary: 10:00 am – 11:00 am (1 hour), 3:00 pm – 4:00 pm (1 hour). Total time bicycle was stationary = 1 + 1 = 2 hours. Therefore, the answer is Option B.',
    percentCorrect: 49.87,
    stimulusGroup: 'The following line graph details the time and distance that Hettie travels by bicycle in a day. The graph shows distance travelled (km) on the y-axis and time of day on the x-axis from 9 am to 5 pm. Key points: at 9 am distance = 0 km, at 10 am distance = 2 km, at 11 am distance = 2 km, at 12 pm distance = 12 km, at 1 pm distance = 20 km, at 2 pm distance = 32 km, at 3 pm distance = 40 km, at 4 pm distance = 40 km, at 5 pm distance = 48 km.',
  },
  {
    topicSlug: 'speed-distance-time',
    questionText: 'From which of the following time periods did Hettie have an average speed of 9 km/h?',
    options: ['9 am to 12 pm', '10 am to 1 pm', '11 am to 1 pm', '11 am to 2 pm', '1 pm to 5 pm'],
    correctIndex: 2,
    explanation: '(a) Speed 9 am–12 pm = (2+0+10)/3 = 4 km/h. (b) Speed 10 am–1 pm = (0+10+8)/3 = 6 km/h. (c) Speed 11 am–1 pm = (10+8)/2 = 9 km/h. (d) Speed 11 am–2 pm = (10+8+12)/3 = 10 km/h. (e) Speed 1 pm–5 pm = (12+8+0+8)/4 = 7 km/h. Therefore, the answer is Option C.',
    percentCorrect: 30.33,
    stimulusGroup: 'The following line graph details the time and distance that Hettie travels by bicycle in a day. The graph shows distance travelled (km) on the y-axis and time of day on the x-axis from 9 am to 5 pm. Key points: at 9 am distance = 0 km, at 10 am distance = 2 km, at 11 am distance = 2 km, at 12 pm distance = 12 km, at 1 pm distance = 20 km, at 2 pm distance = 32 km, at 3 pm distance = 40 km, at 4 pm distance = 40 km, at 5 pm distance = 48 km.',
  },
  {
    topicSlug: 'speed-distance-time',
    questionText: 'What is Hettie\'s overall average speed for the whole day?',
    options: ['2.5 km/h', '4 km/h', '5.5 km/h', '6 km/h', '9 km/h'],
    correctIndex: 3,
    explanation: 'Average speed over whole day = (2 + 0 + 10 + 8 + 12 + 8 + 0 + 8) / 8 = 48 / 8 = 6 km/h. Therefore, the answer is Option D.',
    percentCorrect: 36.25,
    stimulusGroup: 'The following line graph details the time and distance that Hettie travels by bicycle in a day. The graph shows distance travelled (km) on the y-axis and time of day on the x-axis from 9 am to 5 pm. Key points: at 9 am distance = 0 km, at 10 am distance = 2 km, at 11 am distance = 2 km, at 12 pm distance = 12 km, at 1 pm distance = 20 km, at 2 pm distance = 32 km, at 3 pm distance = 40 km, at 4 pm distance = 40 km, at 5 pm distance = 48 km.',
  },
  {
    topicSlug: 'perimeter',
    questionText: 'The following shape is made out of identical squares. The area of the shape is 48 cm². The identical squares are taken apart and rearranged to form a new shape. What is the perimeter of the new shape?',
    options: ['24 cm', '48 cm', '60 cm', '72 cm', '84 cm'],
    correctIndex: 1,
    explanation: 'Since a shape made of 12 identical squares has an area of 48 cm², the area of each small square must be 48 ÷ 12 = 4 cm². Since the area of a small square is 4 cm², each side must be √4 = 2 cm. Thus, the perimeter of the new shape must be 24 × 2 = 48 cm. Therefore, the answer is Option B.',
    percentCorrect: 42.67,
  },
  {
    topicSlug: 'rotation',
    questionText: 'The shape on the left is rotated to create the shape on the right. Which of the following could be a possible angle for the shape on the left to be rotated either clockwise or anti-clockwise to create the shape on the right?',
    options: ['90°', '135°', '180°', '270°', '285°'],
    correctIndex: 1,
    explanation: 'The shape can either be rotated 135° anti-clockwise or 225° clockwise. Therefore, the answer is Option B.',
    percentCorrect: 65.55,
  },
  {
    topicSlug: 'fractions',
    questionText: 'Nel\'s esky contains water so that it is 3/8 full. Nel then pours 0.63 L into the esky and realises that the esky is 3/4 full. What is the maximum capacity of the esky?',
    options: ['1.49 L', '1.55 L', '1.62 L', '1.68 L', '1.82 L'],
    correctIndex: 3,
    explanation: '3/4 = 6/8. Hence, 6/8 − 3/8 = 3/8 is equivalent to 0.63 L. 1/8 → 0.63 ÷ 3 = 0.21 L. 8/8 → 0.21 × 8 = 1.68 L (maximum capacity of the esky). Therefore, the answer is Option D.',
    percentCorrect: 44.22,
  },
  {
    topicSlug: 'speed-distance-time',
    questionText: 'Bri walks to school at a pace of 3 km/hr. Humphrey jogs to school at a pace of 4 km/hr. If Humphrey lives 2 km further away from school than Bri, and they start at the same time, how long will it be before Humphrey catches up to Bri?',
    options: ['1 hour', '1 hour and 40 minutes', '2 hours', '2 hours and 25 minutes', '3 hours and 10 minutes'],
    correctIndex: 2,
    explanation: 'The relative speed (how much faster Humphrey is gaining on Bri) is: 4 km/h − 3 km/h = 1 km/h. Since Humphrey starts 2 km behind, and gains 1 km every hour, it will take: 2 km ÷ 1 km/h = 2 hours. Therefore, the answer is Option C.',
    percentCorrect: 38.56,
  },
  {
    topicSlug: 'data-interpretation',
    questionText: 'The following pie graph shows the different ages of visitors at a certain beach. Some data on the proportion of each age group is missing. The following statements are made after analysing the graph:\n\n1. 50% of visitors at this beach are between the ages of 21 and 40.\n2. 25% of visitors at this beach are under 20 years old.\n3. If there were 18 visitors that were above the age of 60 years old, then there were a total of 120 visitors.\n\nWhich of the above statement(s) is/are correct?',
    options: ['1 only', '2 only', '3 only', '1 and 2', '2 and 3'],
    correctIndex: 4,
    explanation: 'Statement 1: From the pie graph, there is less than 50% of visitors aged between 21 and 40 at the beach. This statement is incorrect. Statement 2: The sector for visitors under 20 has an angle of 90°, meaning the sector represents 25% of the total pie chart. This statement is correct. Statement 3: If there were 18 visitors above the age of 60, then 15% would represent 18 visitors. Thus, 100% would represent 18 ÷ 0.15 = 120 visitors. This statement is correct. Therefore, the answer is Option E.',
    percentCorrect: 55.78,
  },
  {
    topicSlug: 'protractor-skills',
    questionText: 'Two triangles are shown on the protractor below. What is the value when both of the angles of the triangle are subtracted from 180°?',
    options: ['70°', '85°', '65°', '125°', '115°'],
    correctIndex: 4,
    explanation: 'Triangle A: 50° − 20° = 30°. Triangle B: 160° − 125° = 35°. Total = 30° + 35° = 65°. 180° − 65° = 115°. Therefore, the answer is Option E.',
    percentCorrect: 43.19,
  },
  {
    topicSlug: 'algebra',
    questionText: 'A cargo ship can hold a maximum of 1000 tonnes. It has red, blue, yellow and green cargo containers.\n\n- There is triple the amount of red cargo containers than blue containers.\n- The number of yellow containers is a third the number of green containers.\n- There are double as many green containers as blue containers.\n\nIf this ship is holding its maximum weight, what is the percentage of yellow and green containers?',
    options: ['25%', '30%', '40%', '55%', '65%'],
    correctIndex: 2,
    explanation: 'Let blue = x. Red = 3x. Green = 2x. Yellow = 1/3 of green = 1/3 × 2x = 2x/3. Total = x + 3x + 2x + 2x/3 = 20x/3. Set equal to 1000: 20x/3 = 1000 → x = 150. Green = 300, Yellow = 100. Yellow + Green = 400. 400/1000 × 100% = 40%. Therefore, the answer is Option C.',
    percentCorrect: 38.56,
  },
];

async function seedMath() {
  console.log('Seeding mathematics data...');

  // Create topics
  const topicMap: Record<string, number> = {};
  for (const t of MATH_TOPICS) {
    const created = await prisma.mathTopic.upsert({
      where: { slug: t.slug },
      update: { name: t.name, description: t.description },
      create: t,
    });
    topicMap[t.slug] = created.id;
    console.log(`  ✓ MathTopic: ${t.name}`);
  }

  // Create stimulus groups
  const stimulusGroupMap: Record<string, number> = {};
  for (const q of MATH_QUESTIONS) {
    if (q.stimulusGroup && !stimulusGroupMap[q.stimulusGroup]) {
      const existing = await prisma.mathStimulusGroup.findFirst({
        where: { stimulus: q.stimulusGroup },
      });
      if (existing) {
        stimulusGroupMap[q.stimulusGroup] = existing.id;
      } else {
        const created = await prisma.mathStimulusGroup.create({
          data: { stimulus: q.stimulusGroup },
        });
        stimulusGroupMap[q.stimulusGroup] = created.id;
      }
    }
  }

  // Create questions
  for (let i = 0; i < MATH_QUESTIONS.length; i++) {
    const q = MATH_QUESTIONS[i];
    const topicId = topicMap[q.topicSlug];
    if (!topicId) {
      console.error(`  ✗ Topic not found: ${q.topicSlug}`);
      continue;
    }

    // Check if question already exists (by question text)
    const existing = await prisma.mathQuestion.findFirst({
      where: { questionText: q.questionText, topicId },
    });

    if (!existing) {
      await prisma.mathQuestion.create({
        data: {
          topicId,
          stimulusGroupId: q.stimulusGroup ? stimulusGroupMap[q.stimulusGroup] : null,
          questionText: q.questionText,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          percentCorrect: q.percentCorrect,
        },
      });
    }
    console.log(`  ✓ Q${i + 1}: ${q.topicSlug} (${q.percentCorrect}%)`);
  }

  console.log('Mathematics seed complete.');
}

// Run both seeds sequentially
async function runAllSeeds() {
  await main();
  await seedMath();
}

runAllSeeds()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });