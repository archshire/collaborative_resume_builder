export type CompanyEvidenceStatus = 'supported' | 'partial' | 'self-reported' | 'none';
export type CompanyCandidate = {
  id: string;
  name: string;
  headline: string;
  contribution: string;
  gaps: readonly string[];
  questions: readonly string[];
  evidence: readonly { requirement: string; status: CompanyEvidenceStatus; excerpt: string }[];
};

const requirements = [
  'Develop and teach practice-informed business and AI courses or electives.',
  'Create applied learning through projects, cases and industry collaboration.',
  'Build partnerships across industry, startups or the public sector.',
  'Bring substantial professional experience in transformation, innovation or a related area.',
  'Show teaching ability or the potential to engage and mentor students.',
  'Translate live organisational problems into structured learning experiences.',
] as const;

export const companyCandidates: readonly CompanyCandidate[] = [
  {
    id: 'aisha-rahman', name: 'Aisha Rahman', headline: 'Educator and responsible-AI programme lead',
    contribution: 'Could contribute established curriculum and learning-assessment practice while connecting responsible AI concepts to public-sector cases.',
    gaps: ['Limited evidence of leading a large industry transformation.', 'The current application shows a smaller commercial network than the role may require.'],
    questions: ['Which industry partners could you involve in the first year?', 'What part did you personally own in the public-sector AI programme?', 'How would you keep practice examples current across semesters?'],
    evidence: [
      { requirement: requirements[0], status: 'supported', excerpt: 'Designed and taught two postgraduate electives on digital strategy, supported by course outlines and teaching evaluations.' },
      { requirement: requirements[1], status: 'supported', excerpt: 'Students completed four public-sector problem briefs; three partners returned for a second cycle.' },
      { requirement: requirements[2], status: 'partial', excerpt: 'Worked with three public agencies, but the application gives limited evidence of startup or commercial partnerships.' },
      { requirement: requirements[3], status: 'partial', excerpt: 'Led learning and adoption for an AI programme; responsibility for the wider transformation is unclear.' },
      { requirement: requirements[4], status: 'supported', excerpt: 'Provides teaching evaluations, assessed student work and six years of learner mentoring.' },
      { requirement: requirements[5], status: 'supported', excerpt: 'Converted agency problems into assessed team briefs with explicit learning outcomes.' },
    ],
  },
  {
    id: 'daniel-tan', name: 'Daniel Tan', headline: 'Transformation and applied-programme lead',
    contribution: 'Could bring live organisational problems, AI-adoption practice and cross-sector partnerships into applied learning.',
    gaps: ['No semester-long university teaching evidence.', 'Limited independent depth in AI governance.', 'No academic research supervision or publication evidence.'],
    questions: ['How would you grade the proposed decision memo?', 'Which governance topics can you teach independently?', 'What evidence shows the partnership remained active after the pilot?'],
    evidence: [
      { requirement: requirements[0], status: 'partial', excerpt: 'Designed a six-session manager programme, but has not taught a semester-long university course.' },
      { requirement: requirements[1], status: 'supported', excerpt: 'Framed applied prototypes and designed a programme in which 11 teams launched pilots.' },
      { requirement: requirements[2], status: 'supported', excerpt: 'Convened a bank, community organisation and software company for a pilot serving 84 participants.' },
      { requirement: requirements[3], status: 'supported', excerpt: 'Led discovery and review design for an AI-assisted workflow across 1,200 enquiries.' },
      { requirement: requirements[4], status: 'self-reported', excerpt: 'Professional facilitation and mentoring are described; student engagement has not been observed.' },
      { requirement: requirements[5], status: 'none', excerpt: 'The approved material does not yet specify learning outputs or assessment criteria.' },
    ],
  },
  {
    id: 'marcus-lee', name: 'Marcus Lee', headline: 'Entrepreneur, investor and startup adviser',
    contribution: 'Could connect students with startup decision-making, venture formation and a broad regional founder network.',
    gaps: ['Little evidence of structured teaching or assessment.', 'AI governance experience is self-reported.', 'Mentoring examples do not describe learner outcomes.'],
    questions: ['Show how you would turn an investment case into an assessed class activity.', 'What evidence demonstrates that people learned from your mentoring?', 'Describe a specific responsible-AI decision you made and its outcome.'],
    evidence: [
      { requirement: requirements[0], status: 'none', excerpt: 'Guest talks are listed, but no course or curriculum design evidence is supplied.' },
      { requirement: requirements[1], status: 'partial', excerpt: 'Ran founder clinics around live venture problems; learning structure and outcomes are not documented.' },
      { requirement: requirements[2], status: 'supported', excerpt: 'Provides named partnerships across 14 startups, two accelerators and a regional investor network.' },
      { requirement: requirements[3], status: 'supported', excerpt: 'Founded and exited one software company and advised eight portfolio companies on growth and product strategy.' },
      { requirement: requirements[4], status: 'self-reported', excerpt: 'Reports mentoring more than 30 founders, without participant or outcome evidence in the approved material.' },
      { requirement: requirements[5], status: 'partial', excerpt: 'Can supply live venture cases, but has not shown how they become structured learning experiences.' },
    ],
  },
] as const;
