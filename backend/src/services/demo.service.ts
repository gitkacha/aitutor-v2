import prisma from '../lib/prisma';

const DEMO_ANALYSES = [
  { vocabScore: 72, vocabComments: 'Good use of descriptive adjectives and varied vocabulary. Words like "remarkable" and "extraordinary" show strong word choice. Could incorporate more subject-specific terminology.', structureScore: 65, structureComments: 'Sentences are mostly well-structured but some run-on sentences affect flow. Varying sentence openings would improve rhythm.', contentScore: 70, contentComments: 'Clear introduction and conclusion. The body paragraphs follow the expected structure well. Some points could be developed further with more specific examples.', overallScore: 69, summary: 'A solid attempt showing good understanding of the text type. Vocabulary is a strength, while sentence structure offers room for improvement. Keep practising to build consistency.' },
  { vocabScore: 45, vocabComments: 'Basic vocabulary with limited variety. Many repeated words and simple adjectives. Try using a thesaurus to find more precise words.', structureScore: 50, structureComments: 'Simple sentence structures throughout. Most sentences follow a subject-verb-object pattern. Try incorporating compound and complex sentences.', contentScore: 55, contentComments: 'The main ideas are present but could be better organised. The expected structure is partially followed. More detailed examples would strengthen the response.', overallScore: 50, summary: 'A developing attempt with room for growth. Focus on expanding vocabulary and varying sentence structures. The content addresses the prompt but needs more depth.' },
  { vocabScore: 88, vocabComments: 'Impressive vocabulary with sophisticated word choices. Excellent use of figurative language and vivid descriptions. The writing demonstrates a strong command of language.', structureScore: 85, structureComments: 'Excellent sentence variety with a natural flow. Complex sentences are used effectively. Transitions between ideas are smooth and logical.', contentScore: 90, contentComments: 'Outstanding structure that perfectly matches the expected format. Each paragraph serves a clear purpose. Strong, specific examples support every point.', overallScore: 88, summary: 'An excellent piece demonstrating strong writing skills across all areas. The vocabulary and content are particularly impressive. This level of writing would score highly in the Selective Test.' },
  { vocabScore: 60, vocabComments: 'Adequate vocabulary with some good word choices. Could benefit from more descriptive language and stronger verbs. Some words are used repetitively.', structureScore: 58, structureComments: 'Sentence structures are mostly correct but lack variety. Some sentences feel choppy when read aloud. Working on sentence flow would improve the overall quality.', contentScore: 62, contentComments: 'The response addresses the prompt and follows the expected structure reasonably well. Ideas are clear but could be more developed. More specific examples would strengthen the argument.', overallScore: 60, summary: 'A competent attempt that meets basic requirements. The writing shows understanding of the text type but would benefit from more sophisticated language and smoother sentence flow.' },
  { vocabScore: 35, vocabComments: 'Very basic vocabulary with frequent repetition. Simple words are overused (good, nice, big, said). Building vocabulary should be a priority.', structureScore: 40, structureComments: 'Mostly simple sentences with limited variation. There are some grammatical errors that affect clarity. Practising different sentence types would help.', contentScore: 38, contentComments: 'The response is brief and does not fully develop the ideas needed. The expected structure is partially followed but key elements are missing. More practice with planning before writing is recommended.', overallScore: 38, summary: 'This attempt shows the writer is still developing fundamental skills. Focus on building vocabulary, learning different sentence structures, and understanding the expected format for each text type.' },
  { vocabScore: 78, vocabComments: 'Strong vocabulary with good use of domain-specific language. Words are well-chosen and precise. The writing demonstrates a developing personal style.', structureScore: 72, structureComments: 'Good sentence variety with effective use of compound and complex sentences. Some transitions could be smoother. The overall flow is solid.', contentScore: 75, contentComments: 'Well-structured response that follows the expected format. Arguments are supported with relevant examples. The conclusion effectively summarises the main points.', overallScore: 75, summary: 'A strong attempt that shows good understanding of the text type. The vocabulary and content work well together. Continued practice will help build consistency and confidence.' },
  { vocabScore: 82, vocabComments: 'Excellent vocabulary with sophisticated word choices. The writing uses vivid imagery and precise language effectively. A strong command of vocabulary is evident.', structureScore: 78, structureComments: 'Very good sentence variety with effective rhythm and flow. Complex structures are used naturally. Minor improvements in transitions would elevate the writing further.', contentScore: 80, contentComments: 'Well-developed response that fully addresses the prompt. The structure closely matches the expected format. Strong evidence and examples support the main ideas.', overallScore: 80, summary: 'A very good attempt demonstrating strong writing skills. The vocabulary use is particularly effective. With continued attention to sentence structure, this writer could achieve excellent results.' },
  { vocabScore: 55, vocabComments: 'Mixed vocabulary with some effective word choices alongside simpler language. The writer occasionally finds the right word but often settles for simpler alternatives.', structureScore: 52, structureComments: 'A mix of simple and compound sentences. Some sentences are well-constructed while others could be improved. Overall readability is good.', contentScore: 58, contentComments: 'The response covers the main points but lacks depth in development. The structure is partially followed. Adding more specific details would strengthen the response.', overallScore: 55, summary: 'A developing attempt that shows potential. The writer understands the basics but needs to work on vocabulary depth, sentence variety, and content development to reach the next level.' },
  { vocabScore: 68, vocabComments: 'Good vocabulary with some effective word choices. The writer uses descriptive language appropriately. A wider range of vocabulary would strengthen the writing.', structureScore: 70, structureComments: 'Solid sentence structure with good variety. Most sentences are well-constructed. The writing has a natural flow with some effective transitions.', contentScore: 72, contentComments: 'Well-organised response that follows the expected structure. Ideas are clear and mostly well-developed. The conclusion effectively wraps up the main points.', overallScore: 70, summary: 'A good attempt showing solid writing skills across all areas. The structure and content are particular strengths. Continued vocabulary development will help this writer excel.' },
  { vocabScore: 92, vocabComments: 'Outstanding vocabulary that demonstrates sophisticated language skills. The writing is rich with precise, vivid, and varied word choices. This is a clear strength.', structureScore: 90, structureComments: 'Exceptional sentence variety with flawless flow. Complex and compound sentences are used masterfully. The writing has a natural, engaging rhythm throughout.', contentScore: 88, contentComments: 'Exemplary structure that perfectly matches the text type. Every paragraph serves a clear purpose and flows logically to the next. Arguments are well-supported with specific, compelling evidence.', overallScore: 90, summary: 'An outstanding piece of writing that demonstrates excellence across all criteria. This is the standard of writing that would achieve top marks in the Selective Test. Continue to challenge yourself with increasingly complex topics.' },
  { vocabScore: 42, vocabComments: 'Limited vocabulary with many commonly used words. The writing would benefit from more descriptive language and precise word choices. Consider using a dictionary to expand word knowledge.', structureScore: 45, structureComments: 'Simple sentence structures with limited variation. Some sentences are incomplete or run-on. Practising different sentence types and proofreading would help.', contentScore: 48, contentComments: 'The response addresses the prompt but lacks detail and organisation. The expected structure is partially followed but key elements are underdeveloped. Planning before writing would help organise ideas more effectively.', overallScore: 45, summary: 'This attempt shows the writer is still developing their skills. Focus on vocabulary building, sentence structure variety, and organising content according to the expected format.' },
  { vocabScore: 75, vocabComments: 'Good vocabulary with several effective word choices. The writer uses descriptive language well. Continued expansion of vocabulary will strengthen future responses.', structureScore: 68, structureComments: 'Good variety in sentence structures. Some sentences are very effective while others feel more basic. Working on transitions between ideas would improve flow.', contentScore: 73, contentComments: 'Well-structured response that follows the expected format. Ideas are developed with relevant examples. The response could benefit from deeper analysis in some sections.', overallScore: 72, summary: 'A solid attempt showing good writing skills. The vocabulary and content are strengths. Focus on sentence structure and transitions to elevate the overall quality.' },
  { vocabScore: 58, vocabComments: 'Adequate vocabulary with some attempts at more sophisticated words. The writer is clearly trying to expand their vocabulary but not all attempts are successful. Keep reading widely to build word knowledge.', structureScore: 55, structureComments: 'Reasonable sentence variety but inconsistent. Some sections flow well while others feel disjointed. Practicing connecting ideas between sentences would help.', contentScore: 60, contentComments: 'The response covers the main requirements of the text type. The structure is followed but could be more consistently applied. Adding more specific examples would strengthen the response.', overallScore: 58, summary: 'A developing attempt with some strengths. The writer shows understanding of the text type and attempts good vocabulary. Continued practice and wider reading will help build skills.' },
  { vocabScore: 85, vocabComments: 'Very strong vocabulary with sophisticated word choices used naturally. The writing demonstrates a wide-ranging vocabulary that is used precisely and effectively.', structureScore: 82, structureComments: 'Excellent sentence variety with effective use of different structures. The writing flows well with smooth transitions between ideas.', contentScore: 84, contentComments: 'Well-developed response that fully addresses the prompt. The structure closely follows the expected format with strong evidence and analysis throughout.', overallScore: 84, summary: 'A very strong attempt demonstrating confident writing skills. The vocabulary and content are particularly effective. This writer is well-prepared for the Selective Test.' },
  { vocabScore: 48, vocabComments: 'Basic vocabulary that could be significantly expanded. Many words are repeated unnecessarily. Reading widely and keeping a vocabulary journal would be beneficial.', structureScore: 42, structureComments: 'Limited sentence variety with some grammatical errors. Many sentences follow the same pattern which makes the writing feel repetitive. Varying sentence openings would help.', contentScore: 45, contentComments: 'The response addresses the prompt but is brief and lacks development. The expected structure is partially followed. More detailed planning before writing is recommended.', overallScore: 45, summary: 'This attempt indicates the writer is still building foundational writing skills. Prioritise vocabulary development, sentence structure practice, and understanding text type expectations.' },
];

async function getDemoType(typeName: string) {
  return prisma.writingType.findUnique({ where: { slug: typeName } });
}

async function getDemoPrompt(typeId: number) {
  const prompts = await prisma.prompt.findMany({
    where: { typeId },
    take: 1,
  });
  return prompts[0];
}

export async function loadDemoData() {
  // Check if demo data already exists
  const existingDemo = await prisma.attempt.findFirst({ where: { isDemo: true } });
  if (existingDemo) {
    return { message: 'Demo data already loaded. Clear it first if you want to reload.' };
  }

  const typeSlugs = [
    'persuasive', 'narrative-creative', 'discussion', 'letter', 'speech',
    'news-report', 'review', 'diary-entry', 'advertisement', 'guide', 'advice-sheet',
  ];

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  let attemptCount = 0;

  for (let i = 0; i < typeSlugs.length; i++) {
    const type = await getDemoType(typeSlugs[i]);
    if (!type) continue;

    const prompt = await getDemoPrompt(type.id);
    if (!prompt) continue;

    // Create 1-2 attempts per type
    for (let j = 0; j < 2; j++) {
      const daysAgo = Math.floor(Math.random() * 28) + 1;
      const startedAt = new Date(now - daysAgo * DAY - 1800 * 1000);
      const finishedAt = new Date(startedAt.getTime() + (Math.floor(Math.random() * 1500) + 300) * 1000);
      const timeTaken = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000);

      const analysisIndex = (i * 2 + j) % DEMO_ANALYSES.length;
      const analysis = DEMO_ANALYSES[analysisIndex];

      const attempt = await prisma.attempt.create({
        data: {
          typeId: type.id,
          promptId: prompt.id,
          text: getSampleText(typeSlugs[i]),
          startedAt,
          finishedAt,
          timeTaken,
          source: 'practice',
          isDemo: true,
          analysis: {
            create: {
              ...analysis,
              isDemo: true,
            },
          },
        },
      });

      attemptCount++;
    }
  }

  // Create a demo worksheet with one attempt
  const demoType = await getDemoType('persuasive');
  if (demoType) {
    const demoPrompt = await getDemoPrompt(demoType.id);
    const worksheet = await prisma.worksheet.create({
      data: {
        title: 'Worksheet: Persuasive + Discussion',
        typeId: demoType.id,
        prompts: JSON.stringify([
          'Argue whether schools should have a four-day week.',
          'Discuss the pros and cons of homework.',
          'Write a persuasive letter to your local council about a community issue.',
        ]),
        isDemo: true,
      },
    });

    if (demoPrompt) {
      const wsStartedAt = new Date(now - 2 * DAY - 1800 * 1000);
      const wsFinishedAt = new Date(wsStartedAt.getTime() + 1200 * 1000);

      await prisma.attempt.create({
        data: {
          typeId: demoType.id,
          promptId: demoPrompt.id,
          text: 'I believe that schools should have a four-day week because it would give students more time to rest and pursue other interests. Many students feel tired after five days of school and having an extra day off would help them recharge. Additionally, families could spend more quality time together on the long weekend. However, some people argue that less school time means less learning. But I think students would actually learn better if they were more rested and focused during the four days they are at school. In conclusion, a four-day school week would benefit students, families, and even teachers by creating a better balance between school and life.',
          startedAt: wsStartedAt,
          finishedAt: wsFinishedAt,
          timeTaken: 1200,
          source: 'worksheet',
          worksheetId: worksheet.id,
          isDemo: true,
          analysis: {
            create: {
              vocabScore: 68,
              vocabComments: 'Good use of persuasive language with words like "benefit" and "recharge". The writing uses effective transition words like "additionally" and "however". Could incorporate more sophisticated vocabulary.',
              structureScore: 72,
              structureComments: 'Well-structured sentences with good variety. The argument flows logically from point to point. Some sentences could be more concise for greater impact.',
              contentScore: 75,
              contentComments: 'Clear thesis statement with well-supported arguments. The counter-argument is addressed effectively. The conclusion summarises the main points well. A strong persuasive structure is followed.',
              overallScore: 72,
              summary: 'A solid persuasive piece that demonstrates good understanding of the text type. The structure and argument development are strengths. Continued vocabulary development will help elevate future responses.',
              isDemo: true,
            },
          },
        },
      });

      attemptCount++;
    }
  }

  return { message: `Demo data loaded: ${attemptCount} attempts created across ${typeSlugs.length} text types.` };
}

export async function clearDemoData() {
  // Delete demo analyses, attempts, worksheets, in order
  await prisma.analysis.deleteMany({ where: { isDemo: true } });
  await prisma.attempt.deleteMany({ where: { isDemo: true } });
  await prisma.worksheet.deleteMany({ where: { isDemo: true } });

  return { message: 'Demo data cleared successfully. Your real attempts have not been touched.' };
}

function getSampleText(type: string): string {
  const texts: Record<string, string> = {
    persuasive: 'I strongly believe that every school should have a student-run newspaper. Firstly, it would give students a creative outlet to express their ideas and opinions. Secondly, it would teach valuable skills like writing, editing, and teamwork. Finally, it would bring the school community together by sharing news and stories. Some might say it would be too much work, but the benefits far outweigh the challenges. A student newspaper would create a stronger, more connected school community.',
    'narrative-creative': 'The moment I opened the door, I knew nothing would ever be the same again. The room was not how I had left it. Books were scattered across the floor, and the window was wide open, curtains billowing in the wind. But strangest of all was the map lying on my desk. It was old and yellowed, with markings I had never seen before. My hands trembled as I picked it up. Little did I know that this discovery would lead me on the greatest adventure of my life.',
    discussion: 'The question of whether homework should be banned in primary schools is a complex one. On one hand, homework reinforces what students learn in class and teaches responsibility. Many parents believe it helps their children develop good study habits. On the other hand, children need time to play, rest, and spend time with family. Some studies show that excessive homework causes stress and burnout in young students. In my opinion, a balanced approach would be best, with limited but meaningful homework assigned.',
    letter: 'Dear Principal, I am writing to express my strong support for building a new outdoor play area at our school. As a student who has been here for three years, I have seen how crowded our current playground gets during lunch breaks. A new play area would give students more space to be active and would help reduce arguments over equipment. It would also show that our school values student wellbeing. I would be happy to help with fundraising efforts. Yours sincerely, A Student.',
    speech: 'Good morning teachers and fellow students. Today I want to talk about why kindness is the most important quality a leader can have. A leader who is kind listens to others, understands their struggles, and works to help everyone succeed. Kindness is not weakness, it is strength. It takes courage to be kind when things get difficult. As the famous saying goes, "A leader is one who knows the way, goes the way, and shows the way." And the best way to lead is with kindness.',
    'news-report': 'SYDNEY: A local community has banded together to save a historic building from demolition. The old library, which has stood in the town centre for over 120 years, was scheduled to be knocked down next month. However, residents formed a protest group and collected over 5,000 signatures on a petition. "This building is part of our history," said Mrs Sarah Thompson, a local resident. The council has agreed to reconsider its decision. A meeting will be held next week to discuss alternative plans.',
    review: 'I recently read "The Lost Adventures" by Jessica Moore, and I was thoroughly impressed. The story follows three friends who discover a hidden world beneath their school. The characters are well-developed and relatable, each with their own unique personality. The plot moves at a good pace, with plenty of twists to keep readers engaged. The author\'s descriptive writing makes the hidden world come alive. I would give this book five out of five stars and recommend it to anyone who loves adventure stories.',
    'diary-entry': 'Dear Diary, Today was the most amazing day! I discovered that I can sing. It happened during music class when Mrs Chen asked me to try a solo part. I was so nervous, but when I opened my mouth, the notes came out clear and beautiful. Everyone clapped, and I felt a warmth spread through my chest. I can\'t believe I\'ve been hiding this voice inside me all these years. I signed up for the school choir immediately. I can\'t wait for tomorrow\'s practice!',
    advertisement: 'Introducing the AquaPure Water Bottle. The bottle that filters water as you drink! Made from sustainable materials, our bottle removes 99.9% of impurities while keeping your drink cold for 24 hours. Perfect for school, sports, or travel. Features include a built-in filter indicator, leak-proof design, and a comfortable grip. Join thousands of satisfied customers and help reduce plastic waste. Order now and get 20% off your first purchase. AquaPure. Drink better. Live better.',
    guide: 'Welcome to Sydney\'s public transport system. This guide will help you navigate like a local. First, get an Opal card from any convenience store or train station. Tap on when you board and tap off when you leave. Trains run frequently between major stations from 5am to midnight. Buses cover areas that trains don\'t reach. Ferries are a beautiful way to travel across the harbour. Remember to check the Transport NSW app for real-time updates and service changes. Always stand behind the yellow line on platforms and give up your seat for elderly passengers.',
    'advice-sheet': 'Starting at a new school can be nerve-wracking, but these tips will help you settle in. Tip 1: Smile and say hello to people. A simple greeting can start a conversation. Tip 2: Join a club or sport. This is a great way to meet people who share your interests. Tip 3: Ask questions. If you\'re not sure where something is or how something works, just ask. Tip 4: Be yourself. Don\'t pretend to be someone you\'re not. Tip 5: Give it time. Making friends and feeling comfortable takes time. Be patient and keep trying. You\'ll find your place before you know it.',
  };

  return texts[type] || 'This is a sample writing piece for demonstration purposes. It shows the format and structure of a typical response for this text type. The student has addressed the prompt and followed the expected structure to demonstrate their understanding of the genre.';
}