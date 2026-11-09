/** Original Speaking / Writing prompts (curated fallback + style anchors). */

export interface RepeatSet {
  id: string;
  topic: string;
  context: string;
  /** Seven sentences, increasing in length/complexity. */
  sentences: string[];
}

export interface InterviewSet {
  id: string;
  theme: string;
  context: string;
  intro: string;
  questions: string[];
}

export interface EmailTask {
  id: string;
  scenario: string;
  to: string;
  subject: string;
  bullets: string[];
}

export interface DiscussionTask {
  id: string;
  field: string;
  professor: string;
  post: string;
  students: Array<{ name: string; post: string }>;
}

export const REPEAT_BANK: RepeatSet[] = [
  {
    id: 'rp-lab-tour', topic: 'campus lab',
    context: 'You are visiting a science lab on a campus tour. Listen to the guide and repeat what she says. Repeat only once.',
    sentences: [
      'Welcome to the chemistry lab.',
      'Please put on your safety glasses.',
      'The storage cabinets are on your left.',
      'Never taste or smell any of the materials.',
      'Each group will receive a set of instructions and a workstation.',
      'If anything spills, tell your instructor before you try to clean it up.',
      'After the experiment, please wash your hands and return all equipment to the shelves.',
    ],
  },
  {
    id: 'rp-library-orient', topic: 'library',
    context: 'A librarian is giving an orientation to new students. Listen and repeat what she says. Repeat only once.',
    sentences: [
      'Welcome to the university library.',
      'Books may be borrowed for four weeks.',
      'The quiet rooms are on the second floor.',
      'You can renew your books online or at the front desk.',
      'Our research librarians are available to help you find sources.',
      'Group study rooms must be reserved at least a day in advance.',
      'If you cannot find what you need, we can request it from another library for you.',
    ],
  },
  {
    id: 'rp-bookstore', topic: 'campus bookstore',
    context: 'You work at the campus bookstore and are learning the store policies. Listen and repeat what your manager says. Repeat only once.',
    sentences: [
      'Good morning, and welcome to the team.',
      'Textbooks are located at the back of the store.',
      'Students can return unopened items within thirty days.',
      'Please ask every customer if they need a bag.',
      'The most popular items this week are notebooks and water bottles.',
      'During the first week of classes, the store will stay open until nine in the evening.',
      'If a customer has a question you cannot answer, please call the supervisor on the red phone.',
    ],
  },
  {
    id: 'rp-student-center', topic: 'student center',
    context: 'A student leader is showing you around the student center. Listen and repeat what he says. Repeat only once.',
    sentences: [
      'This is the student center.',
      'The information desk is next to the main door.',
      'You can find clubs and activities on the second floor.',
      'The cafeteria serves breakfast, lunch, and dinner.',
      'There is a quiet lounge where students can read or relax between classes.',
      'Our events calendar lists concerts, workshops, and meetings that are open to everyone.',
      'If you would like to start a new club, you can pick up the application form at the front desk.',
    ],
  },
];

export const INTERVIEW_BANK: InterviewSet[] = [
  {
    id: 'iv-study-habits', theme: 'study habits',
    context: 'You have volunteered for a research study about student study habits. A researcher will ask you some questions.',
    intro: 'Thank you for joining the study. I’d like to ask you about how you study. First, do you prefer to study alone or with other people? Why?',
    questions: [
      'Thank you for joining the study. I’d like to ask you about how you study. First, do you prefer to study alone or with other people? Why?',
      'I see. Imagine you could study either early in the morning or late at night. Which would you choose, and why?',
      'Interesting. Some people say that taking short breaks improves learning. What are one or two things you could do during a break to feel refreshed? Give reasons for your answer.',
      'Good points. Lastly, many students now use apps and online videos to learn. How might this trend affect schools in positive ways and in negative ways? Please give one example of each.',
    ],
  },
  {
    id: 'iv-shopping', theme: 'shopping and money',
    context: 'You are taking part in a market research interview about shopping habits.',
    intro: 'Hello, and thanks for taking part. Let’s start with a simple question: do you prefer shopping online or in a store? Why?',
    questions: [
      'Hello, and thanks for taking part. Let’s start with a simple question: do you prefer shopping online or in a store? Why?',
      'Thanks. Imagine you are choosing between a more expensive product that lasts longer and a cheaper one that must be replaced often. Which would you choose, and why?',
      'Interesting. Many people feel that shopping can be stressful. What are one or two ways to make shopping a more pleasant experience? Give reasons for your answer.',
      'Good ideas. Finally, some experts think that most shopping will soon be done by home delivery. How might this change affect local shops in positive ways and in negative ways? Please give one example of each.',
    ],
  },
  {
    id: 'iv-free-time', theme: 'free time and hobbies',
    context: 'You are being interviewed for a campus magazine article about how students spend their free time.',
    intro: 'Thanks for talking with me. To begin, how do you usually spend your free time on weekends, and why do you enjoy it?',
    questions: [
      'Thanks for talking with me. To begin, how do you usually spend your free time on weekends, and why do you enjoy it?',
      'Got it. Suppose you could learn either a musical instrument or a new sport this year. Which would you choose, and why?',
      'Interesting. Some students say they feel too busy to relax. What are one or two ways a busy student can find more time for hobbies? Give reasons for your answer.',
      'Thank you. To finish, some people believe that digital entertainment is replacing outdoor activities. How could this affect communities in positive ways and in negative ways? Please give one example of each.',
    ],
  },
  {
    id: 'iv-city-life', theme: 'cities versus small towns',
    context: 'You are taking part in a survey about where people prefer to live.',
    intro: 'Welcome, and thanks for joining the survey. First, would you rather live in a large city or a small town? Why?',
    questions: [
      'Welcome, and thanks for joining the survey. First, would you rather live in a large city or a small town? Why?',
      'I see. Imagine you were offered a job in a city far from your family, with a higher salary. Would you accept it, and why?',
      'Interesting. Some people say that big cities can feel crowded and noisy. What are one or two ways that cities could become more comfortable to live in? Give reasons for your answer.',
      'Thanks. Lastly, more people now work from home. How might this trend affect small towns in positive ways and in negative ways? Please give one example of each.',
    ],
  },
];

export const EMAIL_BANK: EmailTask[] = [
  {
    id: 'em-vendor', to: 'Dana', subject: 'Feedback on the catering company',
    scenario: 'Your coworker, Dana, recommended a catering company for your department’s end-of-term event. You used the company, but several guests were unhappy: the food arrived late and some dishes were cold. You need to tell Dana what happened and discuss what to do next time.',
    bullets: ['Explain what went wrong with the catering.', 'Describe how the guests reacted.', 'Suggest what to do for the next event.'],
  },
  {
    id: 'em-extension', to: 'Professor Kim', subject: 'Request for a project extension',
    scenario: 'You are working on a group project for Professor Kim’s class. One team member became ill, and the group cannot finish the project by the deadline. You need to write to the professor.',
    bullets: ['Explain why the group needs more time.', 'Describe the progress you have made so far.', 'Propose a new deadline and say how you will use the extra time.'],
  },
  {
    id: 'em-repair', to: 'Mr. Alvarez', subject: 'Repair still not completed',
    scenario: 'Three weeks ago, you asked your landlord, Mr. Alvarez, to repair the heater in your apartment. Nobody has come, and the apartment is getting cold. You decide to write to him again.',
    bullets: ['Describe the problem and how it affects you.', 'Remind him of the earlier request.', 'Suggest a date and time when a repair person could visit.'],
  },
  {
    id: 'em-refund', to: 'Customer Service', subject: 'Refund for a canceled workshop',
    scenario: 'You paid for a weekend photography workshop, but the organizers canceled it a day before it began. You have not received a refund or any explanation. You decide to write to customer service.',
    bullets: ['Explain what happened and why you are disappointed.', 'Describe what you expect the company to do.', 'Suggest an alternative, such as a future workshop.'],
  },
  {
    id: 'em-speaker', to: 'Dr. Okafor', subject: 'Invitation to speak at our club',
    scenario: 'You are the president of the environmental club. You would like to invite Dr. Okafor, a researcher who studies local rivers, to give a talk to club members next month.',
    bullets: ['Introduce yourself and the club.', 'Explain why you think her talk would interest members.', 'Suggest possible dates and describe what the club can provide.'],
  },
  {
    id: 'em-shift', to: 'Samira', subject: 'Swapping shifts next weekend',
    scenario: 'You work part-time at the campus café. You have an unexpected family event next Saturday and cannot work your shift. You decide to write to a coworker, Samira, to ask for help.',
    bullets: ['Explain why you cannot work your shift.', 'Ask Samira whether she could cover it.', 'Offer something in return and suggest how to inform your manager.'],
  },
];

export const DISCUSSION_BANK: DiscussionTask[] = [
  {
    id: 'ds-transit', field: 'urban studies',
    professor: 'Today we’re looking at how cities grow. Many mayors must decide between spending limited funds on public transportation, such as buses and trains, or on expanding roads for private cars. Which investment do you think would benefit a city more in the long run, and why?',
    post: '',
    students: [
      { name: 'Claire', post: 'I think public transportation is the better investment. A single train carries far more people than a lane of cars, which reduces traffic and pollution, and it gives people without cars a way to reach jobs.' },
      { name: 'Marcus', post: 'I would choose roads. Many people live far from the city center, where buses are rare, and delivery trucks and emergency vehicles also depend on good roads. Better roads help the economy in many ways.' },
    ],
  },
  {
    id: 'ds-online', field: 'education',
    professor: 'In our unit on learning environments, we’ve been comparing classroom formats. Some argue that online classes give students more flexibility and are just as effective as in-person ones. Others believe face-to-face teaching leads to deeper learning. Which view do you find more convincing?',
    post: '',
    students: [
      { name: 'Priya', post: 'I prefer online classes because I can rewatch lectures and learn at my own speed. This is especially helpful when a topic is difficult.' },
      { name: 'Tom', post: 'I find in-person classes better. Asking questions immediately and talking with classmates helps me stay focused, and I rarely get distracted the way I do at home.' },
    ],
  },
  {
    id: 'ds-plastic', field: 'environmental science',
    professor: 'This week we’re discussing waste reduction. Some governments have banned single-use plastic items such as bags and straws, while others prefer to encourage voluntary recycling. Do you think a ban is the most effective approach? Explain your position.',
    post: '',
    students: [
      { name: 'Elena', post: 'A ban sends a clear message and quickly reduces waste. When bags became unavailable in my city, people simply started bringing their own.' },
      { name: 'Jamal', post: 'I’m not sure a ban is best. Without good alternatives, businesses and families may pay more. Education and incentives for recycling might produce more lasting change.' },
    ],
  },
  {
    id: 'ds-remote', field: 'business',
    professor: 'As we continue our study of organizations, consider the growth of remote work. Some companies now allow employees to work from home permanently, while others require everyone to return to the office. In your view, which arrangement is better for companies and employees?',
    post: '',
    students: [
      { name: 'Hana', post: 'Remote work saves time and money on commuting and often increases productivity. Companies can also hire talented people from anywhere.' },
      { name: 'Luis', post: 'Offices matter for teamwork and for new employees, who learn faster by watching colleagues. I think a regular presence in the office keeps a company’s culture strong.' },
    ],
  },
  {
    id: 'ds-ai-art', field: 'technology and society',
    professor: 'Our reading this week raises a question about creativity. Some people believe artificial intelligence tools will help artists work faster and try new ideas, while others fear that these tools will reduce the value of human creativity. What is your opinion?',
    post: '',
    students: [
      { name: 'Noah', post: 'I think AI can be a helpful assistant. Like a camera or a computer, it is a tool, and the artist still decides what the final work looks like.' },
      { name: 'Aisha', post: 'I’m concerned that people will rely on AI instead of developing skills. If anyone can produce an image in seconds, original human effort may seem less valuable.' },
    ],
  },
  {
    id: 'ds-school-start', field: 'health and psychology',
    professor: 'Research on adolescent sleep has led some school districts to start classes later in the morning. Supporters say students learn better when they are rested, while critics point to practical problems such as transportation and after-school activities. Do you think schools should start later? Why or why not?',
    post: '',
    students: [
      { name: 'Grace', post: 'Yes. I was always tired in early classes, and studies show teenagers naturally fall asleep later. Better rest could improve attention and mood.' },
      { name: 'Omar', post: 'I understand the benefits, but later schedules would make families’ lives harder and shorten time for sports and jobs. Maybe students should simply go to bed earlier.' },
    ],
  },
];
