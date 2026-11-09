import { BankQuestion, BankStimulus } from './bank.types';

type Opts = [string, string, string, string];

// ───────────────────── Listen and Choose a Response ─────────────────────
const CR: Array<[('Man' | 'Woman'), string, Opts]> = [
  ['Woman', 'Where should I leave these boxes?', ['Anywhere by the door is fine.', 'They were delivered yesterday.', 'I left my keys in one of them.', 'Yes, they look quite heavy.']],
  ['Man', 'Is this seat taken?', ['No, go ahead.', 'It’s a very comfortable chair.', 'Yes, I took the bus.', 'The seat belt is broken.']],
  ['Woman', 'Could you lend me a pen?', ['Sure, here you go.', 'I like to write every day.', 'The ink is blue.', 'No, I didn’t lend it to him.']],
  ['Man', 'When is the paper due?', ['By Friday at noon.', 'It’s two thousand words long.', 'It’s on the top shelf.', 'The printer is out of ink.']],
  ['Woman', 'I think I left my umbrella in your car.', ['I’ll check and bring it tomorrow.', 'It stopped raining an hour ago.', 'The car needs to be washed.', 'You can borrow my phone.']],
  ['Man', 'Why don’t we meet after the lecture?', ['Sounds good—see you then.', 'The lecture was quite long.', 'I met her last year.', 'It’s on the second floor.']],
  ['Woman', 'Do you know if the bookstore sells used textbooks?', ['I believe it does, near the back.', 'I used to read a lot as a child.', 'This textbook is really heavy.', 'No, I didn’t know her.']],
  ['Man', 'I’m having trouble logging in to the student portal.', ['Have you tried resetting your password?', 'The porter is at the front door.', 'I write everything in a notebook.', 'It’s a long trip to the city.']],
  ['Woman', 'How did your interview go?', ['Better than I expected.', 'At two o’clock tomorrow.', 'The view was wonderful.', 'I’ll take the train there.']],
  ['Man', 'Would you rather take the morning or the afternoon session?', ['Mornings work better for me.', 'I took it last session.', 'Yes, the session was very good.', 'The session room is upstairs.']],
  ['Woman', 'Haven’t you finished the lab report yet?', ['Almost—I just need to add the graphs.', 'The lab is closed on Sundays.', 'I prefer reports on paper.', 'Yes, I’ll have two, please.']],
  ['Man', 'The cafeteria is out of pasta again.', ['That’s the third time this week.', 'I’ve never been to Italy.', 'It’s next to the cafeteria.', 'Please pass me the salt.']],
  ['Woman', 'I can’t make it to practice tonight.', ['Thanks for letting me know.', 'Practice makes perfect.', 'I’ll make it myself.', 'Tonight’s special is fish.']],
  ['Man', 'What’s the fastest way to get downtown?', ['The express bus runs every ten minutes.', 'I’m going downtown for lunch.', 'It was faster last year.', 'The town is quite small.']],
  ['Woman', 'Do you mind if I open the window?', ['Not at all—it’s stuffy in here.', 'The window is very large.', 'The wind comes from the north.', 'Yes, I opened it before.']],
  ['Man', 'I heard the professor extended the deadline.', ['Really? That gives me more time.', 'He lives close to the campus.', 'I haven’t met her yet.', 'The line is very long.']],
  ['Woman', 'Which of these laptops do you recommend?', ['The lighter one is better for travel.', 'I’ll recommend you to the manager.', 'The laptops are on the top shelf.', 'Yes, they’re all on sale.']],
  ['Man', 'I’m surprised the museum was so crowded.', ['Admission was free today, that’s why.', 'The museum closes at six.', 'I’ll surprise him tomorrow.', 'It’s across from the bank.']],
  ['Woman', 'Should we order the food now or wait for Jake?', ['Let’s wait a few more minutes.', 'Jake ordered it last night.', 'The food was delicious.', 'I’ve waited here before.']],
  ['Man', 'I’m not sure which bus goes to the airport.', ['Let me check the route map.', 'The airport is very busy.', 'I’m sure it was a long flight.', 'You should buy a bigger bag.']],
  ['Woman', 'Did you bring the signed form?', ['It’s in my backpack.', 'I would sign it tomorrow.', 'Both forms are blue.', 'No, I don’t form groups.']],
  ['Man', 'I can’t believe how quickly the semester went by.', ['I know—it feels like it just started.', 'Yes, I believe you can.', 'The semester is on the schedule.', 'It was a quick answer.']],
];

export const CHOOSE_RESPONSE_BANK: BankStimulus[] = CR.map(([speaker, text, options], i) => ({
  id: `cr-${i + 1}`,
  kind: 'CHOOSE_RESPONSE',
  difficulty: 'standard',
  topic: 'daily conversation',
  title: 'Choose the best response',
  body: text,
  meta: { speaker, turns: [{ speaker, text }] },
  questions: [
    {
      type: 'LISTENING_CHOOSE_RESPONSE',
      prompt: 'Choose the best response.',
      options,
      answer: 0,
      explanation: `The correct response directly and naturally answers “${text}” — the other options sound similar or use related words but do not fit the meaning.`,
      skillTag: 'response-selection',
    },
  ],
}));

// ───────────────────────────── Conversations ─────────────────────────────
const T = (speaker: string, text: string) => ({ speaker, text });

const conv = (
  id: string,
  topic: string,
  title: string,
  turns: Array<{ speaker: string; text: string }>,
  questions: BankQuestion[],
): BankStimulus => ({
  id,
  kind: 'CONVERSATION',
  difficulty: 'standard',
  topic,
  title,
  body: turns.map((t) => `${t.speaker}: ${t.text}`).join('\n'),
  meta: { context: 'Listen to a conversation.', turns },
  questions,
});

export const CONVERSATION_BANK: BankStimulus[] = [
  conv('cv-major', 'academic advising', 'Changing a major', [
    T('Woman', 'Hi, I wanted to ask about switching my major from biology to environmental science.'),
    T('Man', 'Sure. What’s behind the change?'),
    T('Woman', 'I took an ecology elective last term, and I loved the fieldwork. But I’m worried I’ll lose a lot of credits.'),
    T('Man', 'Actually, most of your biology courses count toward the environmental science degree, so you’d lose very little.'),
    T('Woman', 'That’s a relief. What do I need to do?'),
    T('Man', 'Fill out a change-of-major form and get the department chair’s signature. The forms are due by Friday if you want the change to start next semester.'),
    T('Woman', 'Friday? I’d better go see the chair this afternoon.'),
  ], [
    { type: 'LISTENING_MAIN_IDEA', prompt: 'Why does the woman visit the advisor?', options: ['To ask about changing her major', 'To register for an ecology elective', 'To apply for a scholarship', 'To complain about a grade'], answer: 0, explanation: 'She opens by asking about switching majors.', skillTag: 'main-idea' },
    { type: 'LISTENING_DETAIL', prompt: 'What is the woman worried about?', options: ['Losing credits', 'Missing the deadline', 'Paying a fee', 'Failing fieldwork'], answer: 0, explanation: 'She says she is worried she will lose many credits.', skillTag: 'detail' },
    { type: 'LISTENING_PREDICTION', prompt: 'What will the woman most likely do next?', options: ['Visit the department chair', 'Drop her ecology course', 'Email the advisor a form', 'Wait until next semester'], answer: 0, explanation: 'She says she will see the chair this afternoon.', skillTag: 'prediction' },
  ]),
  conv('cv-presentation', 'student life', 'Planning a group presentation', [
    T('Man', 'So we have twelve slides to divide. Do you want to take the introduction?'),
    T('Woman', 'I can, but I’m honestly more comfortable with the data section. Would you mind presenting the intro?'),
    T('Man', 'Well, I’m not exactly a fan of public speaking.'),
    T('Woman', 'Then how about this: you present the conclusion, which is shorter, and I’ll handle both the intro and the data.'),
    T('Man', 'That works for me. Should we practice together?'),
    T('Woman', 'Definitely. Let’s meet in the library on Tuesday, and we’ll send the slides to Professor Alvarez on Monday night.'),
  ], [
    { type: 'LISTENING_MAIN_IDEA', prompt: 'What are the speakers mainly discussing?', options: ['How to divide the parts of a presentation', 'Which topic to choose for a project', 'Where to find data for a report', 'How to design the slides'], answer: 0, explanation: 'They are deciding who presents which parts.', skillTag: 'main-idea' },
    { type: 'LISTENING_FUNCTION', prompt: 'What does the man imply when he says, “I’m not exactly a fan of public speaking”?', options: ['He would prefer not to give the longest part.', 'He has never given a presentation.', 'He wants to skip the presentation.', 'He disagrees with the professor.'], answer: 0, explanation: 'He is signaling reluctance, which leads the woman to offer him the shorter conclusion.', skillTag: 'implied-meaning' },
    { type: 'LISTENING_DETAIL', prompt: 'When will the speakers send the slides to the professor?', options: ['Monday night', 'Tuesday morning', 'Tuesday in the library', 'Friday afternoon'], answer: 0, explanation: 'The woman says they will send them on Monday night.', skillTag: 'detail' },
  ]),
  conv('cv-billing', 'campus services', 'A billing error', [
    T('Woman', 'Hello, I’m here about my account. I was charged for a meal plan, but I canceled it in August.'),
    T('Man', 'Let me look that up. Hmm, I see the charge here, but I don’t see a cancellation on file.'),
    T('Woman', 'I got a confirmation email at the time. I can show it to you.'),
    T('Man', 'That would help. If you forward it to me, I can submit a refund request today.'),
    T('Woman', 'How long will the refund take?'),
    T('Man', 'Usually five to seven business days after approval.'),
    T('Woman', 'Okay. I’ll send the email as soon as I get back to my room.'),
  ], [
    { type: 'LISTENING_MAIN_IDEA', prompt: 'What problem does the woman have?', options: ['She was charged for a service she canceled.', 'She lost her meal card.', 'She cannot log in to her account.', 'She missed a payment deadline.'], answer: 0, explanation: 'She was billed for a meal plan she says she canceled.', skillTag: 'main-idea' },
    { type: 'LISTENING_DETAIL', prompt: 'What does the man need from the woman?', options: ['The confirmation email', 'A new application form', 'Her room number', 'A payment receipt'], answer: 0, explanation: 'He asks her to forward the confirmation email.', skillTag: 'detail' },
    { type: 'LISTENING_PREDICTION', prompt: 'What will the woman probably do next?', options: ['Forward the email after returning to her room', 'Wait for five business days', 'Cancel her meal plan again', 'Visit the dining hall'], answer: 0, explanation: 'She says she will send the email as soon as she is back in her room.', skillTag: 'prediction' },
  ]),
  conv('cv-roommates', 'housing', 'Sharing chores', [
    T('Woman', 'Have you seen the kitchen? There are dishes piled up from three days ago.'),
    T('Man', 'Yeah, sorry. I’ve had back-to-back exams all week.'),
    T('Woman', 'I understand, but I’ve been on dish duty since Monday, and it isn’t fair.'),
    T('Man', 'You’re right. What if we rotate every week? I’ll start this time.'),
    T('Woman', 'That sounds good. I’ll buy more soap and sponges tomorrow so we don’t run out.'),
    T('Man', 'Perfect. Let’s write the schedule on the whiteboard.'),
  ], [
    { type: 'LISTENING_MAIN_IDEA', prompt: 'What are the speakers trying to resolve?', options: ['How to share kitchen chores', 'Where to store their food', 'Who should pay the rent', 'When to host a party'], answer: 0, explanation: 'They agree to rotate dish duty weekly.', skillTag: 'main-idea' },
    { type: 'LISTENING_FUNCTION', prompt: 'What does the woman imply when she says, “I’ve been on dish duty since Monday”?', options: ['She feels she has done more than her share.', 'She enjoys washing dishes.', 'She plans to move out.', 'She wants the man to buy new plates.'], answer: 0, explanation: 'She follows it with “it isn’t fair,” showing she feels overburdened.', skillTag: 'implied-meaning' },
    { type: 'LISTENING_DETAIL', prompt: 'What will the woman do tomorrow?', options: ['Buy soap and sponges', 'Wash the dishes', 'Write the schedule', 'Clean the whiteboard'], answer: 0, explanation: 'She says she will buy more soap and sponges tomorrow.', skillTag: 'detail' },
  ]),
];

// ───────────────────────────── Announcements ─────────────────────────────
const ann = (id: string, topic: string, title: string, context: string, text: string, speaker: string, questions: BankQuestion[]): BankStimulus => ({
  id,
  kind: 'ANNOUNCEMENT',
  difficulty: 'easy',
  topic,
  title,
  body: `${speaker}: ${text}`,
  meta: { context, turns: [T(speaker, text)] },
  questions,
});

export const ANNOUNCEMENT_BANK: BankStimulus[] = [
  ann('an-library', 'campus services', 'Library self-checkout', 'Listen to an announcement in a university library.',
    'Attention, library visitors. Self-checkout machines are now available on the first floor, so you no longer need to wait at the main desk to borrow books. Please remember that study rooms on the second floor must now be reserved online in advance. Finally, to celebrate the new system, overdue fines will be waived during the first week of November. Thank you, and happy reading.',
    'Announcer',
    [
      { type: 'LISTENING_MAIN_IDEA', prompt: 'What is the main purpose of the announcement?', options: ['To describe new library services and policies', 'To announce a library closing', 'To ask for book donations', 'To introduce a new librarian'], answer: 0, explanation: 'It covers self-checkout, online room reservations and a fine waiver.', skillTag: 'main-idea' },
      { type: 'LISTENING_DETAIL', prompt: 'How must study rooms on the second floor be reserved?', options: ['Online, in advance', 'At the main desk', 'By phone', 'On the first floor machines'], answer: 0, explanation: 'The speaker says rooms must now be reserved online in advance.', skillTag: 'detail' },
      { type: 'LISTENING_DETAIL', prompt: 'What will happen during the first week of November?', options: ['Overdue fines will not be charged.', 'The library will close early.', 'New books will be free.', 'The study rooms will be open all night.'], answer: 0, explanation: 'Fines will be waived that week.', skillTag: 'detail' },
    ]),
  ann('an-career-fair', 'campus events', 'Career fair', 'Listen to an announcement on the campus radio station.',
    'Good morning, students. The annual career fair takes place this Wednesday from ten to three in the Sports Hall. More than forty employers will be there, so be sure to bring several printed copies of your resume. If you park in Lot B, a free shuttle will take you directly to the hall. We hope to see you there and wish you the best of luck.',
    'Announcer',
    [
      { type: 'LISTENING_MAIN_IDEA', prompt: 'What is the announcement mainly about?', options: ['An upcoming career fair', 'A change in parking rules', 'A sports tournament', 'A resume writing class'], answer: 0, explanation: 'The speaker describes the career fair and how to prepare.', skillTag: 'main-idea' },
      { type: 'LISTENING_DETAIL', prompt: 'What does the speaker advise students to bring?', options: ['Printed copies of their resume', 'Their student ID cards', 'A letter of reference', 'Application fees'], answer: 0, explanation: 'Students should bring several printed resumes.', skillTag: 'detail' },
      { type: 'LISTENING_DETAIL', prompt: 'How can students get to the Sports Hall from Lot B?', options: ['By taking a free shuttle', 'By walking across the campus', 'By renting a bicycle', 'By taking a city bus'], answer: 0, explanation: 'A free shuttle runs from Lot B to the hall.', skillTag: 'detail' },
    ]),
  ann('an-intramural', 'campus events', 'Intramural sign-ups', 'Listen to an announcement at a student recreation center.',
    'Hello, everyone. Sign-ups for intramural basketball close this Friday. Each team needs five players, and registration forms are available at the front desk of the Student Union. Players who are not part of a team can leave their names, and we will do our best to place them. The first games will be held on October third. Please don’t wait until the last day to register.',
    'Announcer',
    [
      { type: 'LISTENING_MAIN_IDEA', prompt: 'What is the purpose of the announcement?', options: ['To encourage students to register for a sports league', 'To announce the results of a game', 'To recruit referees', 'To change the date of a tournament'], answer: 0, explanation: 'The speaker explains how to register for intramural basketball.', skillTag: 'main-idea' },
      { type: 'LISTENING_DETAIL', prompt: 'What can students without a team do?', options: ['Leave their names so they can be placed', 'Play only in practice sessions', 'Wait until the next season', 'Form a team of three'], answer: 0, explanation: 'Individual players can leave their names for placement.', skillTag: 'detail' },
      { type: 'LISTENING_DETAIL', prompt: 'What does the speaker hope the listeners will do?', options: ['Register before the last day', 'Attend practice on Friday', 'Buy tickets for the first game', 'Volunteer as coaches'], answer: 0, explanation: 'She asks them not to wait until the last day to register.', skillTag: 'speaker-purpose' },
    ]),
];

// ──────────────────────────── Academic talks ────────────────────────────
const talk = (id: string, topic: string, title: string, context: string, text: string, questions: BankQuestion[]): BankStimulus => ({
  id,
  kind: 'ACADEMIC_TALK',
  difficulty: 'standard',
  topic,
  title,
  body: `Professor: ${text}`,
  meta: { context, turns: [T('Professor', text)] },
  questions,
});

export const TALK_BANK: BankStimulus[] = [
  talk('tk-coral', 'Biology', 'Coral bleaching', 'Listen to part of a talk in a marine biology class.',
    'Today I want to talk about coral bleaching, which you have probably seen in photographs of reefs turning pale white. Corals are animals, but they depend on microscopic algae that live inside their tissue. The algae carry out photosynthesis and give the coral most of its food and also its color. When the water becomes too warm, even by one or two degrees for several weeks, the coral becomes stressed and expels the algae. Without them, the coral loses its color and begins to starve. Now, a bleached coral isn’t necessarily dead. If the water cools soon enough, algae can return and the coral can recover. But repeated heat waves don’t give reefs time to recover. One team studying a reef in the Pacific found that sections shaded by cloud cover bleached much less than exposed sections. So some researchers are testing ways to provide artificial shade over small areas of reef, something like a giant umbrella. It’s an interesting idea, but of course it can’t be used across thousands of kilometers of ocean. Next time, we’ll look at how coral species differ in their tolerance to heat.',
    [
      { type: 'LISTENING_MAIN_IDEA', prompt: 'What is the talk mainly about?', options: ['Why corals lose their color when the water warms', 'How algae are grown in laboratories', 'Where the largest reefs are located', 'How photographers study coral'], answer: 0, explanation: 'The professor explains bleaching as a response to warm water.', skillTag: 'main-idea' },
      { type: 'LISTENING_DETAIL', prompt: 'According to the professor, what do the algae provide to the coral?', options: ['Most of its food and its color', 'Protection from predators', 'Shade from the sun', 'Minerals for its skeleton'], answer: 0, explanation: 'The algae give the coral most of its food and also its color.', skillTag: 'detail' },
      { type: 'LISTENING_FUNCTION', prompt: 'Why does the professor mention a study of a reef in the Pacific?', options: ['To show that less sun exposure can reduce bleaching', 'To prove that bleached coral always dies', 'To compare Pacific and Atlantic reefs', 'To explain how algae are counted'], answer: 0, explanation: 'Shaded sections bleached less, which led to the shading idea.', skillTag: 'function' },
      { type: 'LISTENING_INFERENCE', prompt: 'What does the professor imply about artificial shade?', options: ['It is not practical for protecting entire reefs.', 'It has already saved most reefs.', 'It harms the algae.', 'It is cheaper than cooling the ocean.'], answer: 0, explanation: 'She says it cannot be used across thousands of kilometers of ocean.', skillTag: 'inference' },
      { type: 'LISTENING_PREDICTION', prompt: 'What will the professor most likely discuss next time?', options: ['Differences in heat tolerance among coral species', 'The history of photography', 'Ways to make artificial reefs', 'The food of reef fish'], answer: 0, explanation: 'She ends by announcing the topic of the next lecture.', skillTag: 'prediction' },
    ]),
  talk('tk-impressionism', 'Art History', 'Impressionism and photography', 'Listen to part of a talk in an art history class.',
    'When photography became widespread in the mid-1800s, many painters worried. If a camera could record a scene exactly, what was left for painters to do? Some artists responded by changing what painting was for. The Impressionists, for example, stopped trying to copy every detail. Instead, they tried to capture the fleeting effect of light at a particular moment: the shimmer of water, the blur of a crowd, the way a haystack looks different at dawn and at dusk. Early cameras couldn’t do this. Exposures were long, so moving subjects came out blurred, and the images were black and white. Painters used loose brushstrokes and bright, unmixed colors to suggest what the eye experiences rather than what a lens records. Interestingly, the relationship wasn’t only competitive. Photography also influenced the way painters composed their scenes. Many Impressionist paintings have unusual cropping, with figures cut off at the edge of the canvas, which looks a lot like a snapshot. So photography didn’t replace painting; it pushed painters into new territory.',
    [
      { type: 'LISTENING_MAIN_IDEA', prompt: 'What is the main point of the talk?', options: ['Photography influenced the direction of painting.', 'Impressionists refused to look at photographs.', 'Early cameras produced better images than paintings.', 'Painting declined because of photography.'], answer: 0, explanation: 'The professor says photography pushed painters into new territory.', skillTag: 'main-idea' },
      { type: 'LISTENING_DETAIL', prompt: 'Why could early cameras not capture fleeting effects of light?', options: ['Their exposures were long and the images were black and white.', 'They were too expensive for artists.', 'They could not photograph water.', 'They were banned in some cities.'], answer: 0, explanation: 'Long exposures blurred moving subjects and there was no color.', skillTag: 'detail' },
      { type: 'LISTENING_FUNCTION', prompt: 'Why does the professor mention figures cut off at the edge of the canvas?', options: ['To show how photography affected the composition of paintings', 'To criticize the skill of the painters', 'To explain how canvases were prepared', 'To describe the cost of materials'], answer: 0, explanation: 'The cropping resembles a snapshot, showing photographic influence.', skillTag: 'function' },
      { type: 'LISTENING_INFERENCE', prompt: 'What does the professor imply about the Impressionists?', options: ['They did not consider exact copying to be the main goal of painting.', 'They were unable to paint realistic scenes.', 'They disliked bright colors.', 'They preferred painting indoors.'], answer: 0, explanation: 'They aimed to capture the experience of light instead of detail.', skillTag: 'inference' },
    ]),
  talk('tk-sunk-cost', 'Economics', 'The sunk cost fallacy', 'Listen to part of a talk in an economics class.',
    'Imagine you have bought a ticket for a concert, but on the night it is snowing hard and you are feeling sick. Do you go anyway, because you paid for the ticket? Many people say yes. Economists call this the sunk cost fallacy: allowing money or effort that has already been spent, and cannot be recovered, to influence a decision about the future. The money is gone whether you go or not. The only sensible question is whether the concert is worth the trouble now. Sunk costs affect big decisions too. A company might keep funding a failing project because it has already invested millions. Governments have continued unsuccessful construction projects for the same reason. Why does this happen? One explanation is that people dislike admitting a loss. Stopping feels like confirming a mistake. Another is the wish to avoid looking wasteful. Researchers suggest a simple strategy: ask yourself, “If I hadn’t already invested anything, would I start this today?” If the answer is no, it may be time to stop.',
    [
      { type: 'LISTENING_MAIN_IDEA', prompt: 'What is the talk mainly about?', options: ['Letting past spending influence future decisions', 'How to buy concert tickets cheaply', 'Why companies avoid investing', 'How governments plan construction'], answer: 0, explanation: 'The professor defines and explains the sunk cost fallacy.', skillTag: 'main-idea' },
      { type: 'LISTENING_FUNCTION', prompt: 'Why does the professor describe the concert example?', options: ['To illustrate the fallacy in an everyday situation', 'To show that concerts are costly', 'To warn students about winter travel', 'To compare two kinds of tickets'], answer: 0, explanation: 'It makes the abstract idea concrete before the larger examples.', skillTag: 'function' },
      { type: 'LISTENING_DETAIL', prompt: 'According to the professor, why do people continue with failing projects?', options: ['They dislike admitting a loss.', 'They enjoy taking risks.', 'They lack information about costs.', 'They want to help other investors.'], answer: 0, explanation: 'She says people dislike admitting a loss and stopping feels like confirming a mistake.', skillTag: 'detail' },
      { type: 'LISTENING_INFERENCE', prompt: 'What is the purpose of the question the professor recommends asking?', options: ['To separate past spending from future value', 'To calculate the price of a project', 'To find out who is responsible for a mistake', 'To persuade others to invest'], answer: 0, explanation: 'It removes the influence of past investment from the decision.', skillTag: 'inference' },
    ]),
  talk('tk-crows', 'Biology', 'Tool use in crows', 'Listen to part of a talk in an animal behavior class.',
    'Let’s turn to animal cognition. For a long time, people believed that making and using tools was uniquely human. Then researchers observed chimpanzees stripping leaves from twigs to fish termites out of their mounds. Even more surprising, though, are birds. New Caledonian crows bend wire into hooks to lift small baskets out of tubes in laboratory tests, and in the wild they shape twigs and the edges of leaves into tools for pulling insects out of tree bark. Here’s what I find most interesting: young crows that had never seen an adult make a tool still tried to make one, which suggests an inherited tendency, but their skill improved after they watched others. So it seems to be a combination of instinct and learning. Now, researchers are careful about what this proves. Using a tool is not the same as understanding why it works. To explore that, scientists design problems where the obvious approach fails, and they see whether the bird adapts. Crows often do. That suggests flexible problem-solving, though how it compares with human reasoning is still debated.',
    [
      { type: 'LISTENING_MAIN_IDEA', prompt: 'What is the main topic of the talk?', options: ['Evidence of tool use and problem-solving in animals', 'How chimpanzees communicate', 'Why crows migrate', 'The history of animal research'], answer: 0, explanation: 'The professor reviews tool use in chimpanzees and crows and what it suggests.', skillTag: 'main-idea' },
      { type: 'LISTENING_FUNCTION', prompt: 'Why does the professor mention chimpanzees?', options: ['To give an earlier example of animal tool use', 'To contrast them with crows in intelligence', 'To explain why crows copy other animals', 'To describe laboratory methods'], answer: 0, explanation: 'Chimpanzees were the first surprising case before birds.', skillTag: 'function' },
      { type: 'LISTENING_DETAIL', prompt: 'What did researchers observe about young crows that had never seen a tool made?', options: ['They still tried to make tools.', 'They refused to use tools.', 'They copied chimpanzees.', 'They made better tools than adults.'], answer: 0, explanation: 'They tried to make tools anyway, suggesting an inherited tendency.', skillTag: 'detail' },
      { type: 'LISTENING_INFERENCE', prompt: 'What does the professor imply about using a tool?', options: ['It does not necessarily show that the animal understands how it works.', 'It proves that animals reason like humans.', 'It is always learned from adults.', 'It is rare among birds.'], answer: 0, explanation: 'She says using a tool is not the same as understanding why it works.', skillTag: 'inference' },
    ]),
];
