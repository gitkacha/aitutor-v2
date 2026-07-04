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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });