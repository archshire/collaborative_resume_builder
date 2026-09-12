import type { Requirement } from './demo-access';

export const applicantDemo = {
  sourceUrl: 'https://careers.sutd.edu.sg/job/Singapore-Faculty-Member-Practice-Track-Position-in-Business-and-AI-%28DAI%29-138682/57976944/',
  company: 'Singapore University of Technology and Design (SUTD)',
  jobDescription: `Faculty Member – Practice-Track Position in Business and AI (DAI)

SUTD is seeking an experienced practitioner, leader, investor, entrepreneur or practitioner-scholar to contribute practice-informed teaching and industry engagement. The role connects business and AI with technology, design and society.

Responsibilities include developing and teaching courses and electives; contributing to interdisciplinary and applied learning through projects, industry collaborations, internships, studios and cases; building partnerships with industry, startups and the public sector; mentoring students; supporting curriculum and programme development; and contributing to executive education and thought leadership.

Relevant areas include AI-enabled business transformation and strategy, digital transformation, innovation and change management, analytics, new business models and entrepreneurship, venture capital, responsible business and AI governance.

Applicants should bring substantial industry, entrepreneurial, consulting, public-sector or professional experience; evidence of teaching ability or potential to engage students; active professional networks; and strong communication, collaboration and stakeholder skills.`,
  summary: 'SUTD needs a practitioner who can turn current business and AI experience into applied teaching, student projects and durable industry relationships. Daniel brings credible transformation and facilitation experience, with gaps in formal university teaching, academic output and AI governance depth.',
  requirements: [
    { text: 'Develop and teach practice-informed business and AI courses or electives.', basis: 'stated', sourceQuote: 'developing and teaching courses and electives' },
    { text: 'Create applied learning through projects, cases and industry collaboration.', basis: 'stated', sourceQuote: 'applied learning through projects, industry collaborations, internships, studios and cases' },
    { text: 'Build partnerships across industry, startups or the public sector.', basis: 'stated', sourceQuote: 'building partnerships with industry, startups and the public sector' },
    { text: 'Bring substantial professional experience in transformation, innovation or a related area.', basis: 'stated', sourceQuote: 'substantial industry, entrepreneurial, consulting, public-sector or professional experience' },
    { text: 'Show teaching ability or the potential to engage and mentor students.', basis: 'stated', sourceQuote: 'evidence of teaching ability or potential to engage students' },
    { text: 'Translate live organisational problems into structured learning experiences.', basis: 'interpretation', sourceQuote: 'practice-informed teaching and industry engagement' },
  ] satisfies Requirement[],
  initialEvidence: [
    { requirement: 'Develop and teach practice-informed business and AI courses or electives.', status: 'partial', excerpt: 'Designed a six-session programme for 32 managers, but has not taught a semester-long university course.' },
    { requirement: 'Create applied learning through projects, cases and industry collaboration.', status: 'supported', excerpt: 'Framed a four-week prototype and designed a manager programme in which 11 teams launched pilots.' },
    { requirement: 'Build partnerships across industry, startups or the public sector.', status: 'supported', excerpt: 'Convened a bank, community organisation and software company for a pilot serving 84 participants.' },
    { requirement: 'Bring substantial professional experience in transformation, innovation or a related area.', status: 'supported', excerpt: 'Led discovery and pilot review for an AI-assisted workflow across 1,200 enquiries.' },
    { requirement: 'Show teaching ability or the potential to engage and mentor students.', status: 'self-reported', excerpt: 'Professional facilitation and workplace mentoring are described; student engagement has not been observed.' },
    { requirement: 'Translate live organisational problems into structured learning experiences.', status: 'none', excerpt: 'The first interview does not yet describe learning outputs or assessment criteria.' },
  ],
  updatedEvidence: [
    { requirement: 'Develop and teach practice-informed business and AI courses or electives.', status: 'partial', excerpt: 'Proposed an elective structure and assessment outputs, but it has not been delivered at university level.' },
    { requirement: 'Create applied learning through projects, cases and industry collaboration.', status: 'supported', excerpt: 'Described organisational workflow diagnosis, user research, prototyping and a decision memo as student outputs.' },
    { requirement: 'Build partnerships across industry, startups or the public sector.', status: 'supported', excerpt: 'Verified 84 first-cycle participants and continuation into a second workshop cycle.' },
    { requirement: 'Bring substantial professional experience in transformation, innovation or a related area.', status: 'supported', excerpt: 'Led discovery and human-review design for a measured AI-assisted workflow pilot.' },
    { requirement: 'Show teaching ability or the potential to engage and mentor students.', status: 'partial', excerpt: 'Has professional facilitation and mentoring evidence, but no assessed university teaching outcomes.' },
    { requirement: 'Translate live organisational problems into structured learning experiences.', status: 'supported', excerpt: 'Defined concrete student work and assessment evidence around a real organisational workflow.' },
  ],
  questions: [
    'What do you think SUTD needs this person to accomplish in the first year?',
    'Tell us about an AI-enabled or digital transformation you personally led. What changed?',
    'Describe a workshop, class or learning programme you designed and facilitated.',
    'How have you turned an ambiguous industry problem into an applied project?',
    'Give an example of building a partnership across different organisations or sectors.',
    'How have you mentored someone through a difficult professional or technical challenge?',
    'What evidence do you have that participants learned or changed their practice?',
    'Which parts of this role would require you to learn or seek support?',
  ],
  profile: {
    Name: 'Daniel Tan', Email: 'daniel.tan@example.com', Phone: '+65 8123 4567', Location: 'Singapore',
    LinkedIn: 'https://linkedin.com/in/daniel-tan-demo', GitHub: '', Portfolio: 'https://danieltan.example.com',
    Education: 'MBA, Strategy and Innovation — National University of Singapore, 2016\nBSc, Communications and New Media — National University of Singapore, 2010',
    Certifications: 'Design Thinking Facilitation — fictional internal programme, 2021',
    'Skills and tools': 'Digital transformation; service design; workshop facilitation; stakeholder engagement; product strategy; applied generative AI prototyping; programme design',
    'Other notes from uploaded doc': 'This is fictional demonstration data. Daniel has delivered professional workshops but has not held a university faculty appointment or published academic research.',
  },
  transcript: `Interviewer: What do you think SUTD needs this person to accomplish in the first year?
Applicant: I think SUTD needs someone who can bring live business problems into the classroom, help students make sound decisions about AI, and build partnerships that lead to projects rather than one-off guest talks. I would first listen to faculty and students, then shape one elective and a small set of industry briefs that fit the curriculum.

Interviewer: Tell us about an AI-enabled or digital transformation you personally led. What changed?
Applicant: At Meridian Services, I led the discovery and pilot for an AI-assisted customer enquiry workflow across operations, product and compliance. I interviewed 18 frontline staff, mapped failure points and set rules for human review. The eight-week pilot reduced average handling time from 14 to 9 minutes across 1,200 enquiries, while the quality team found no increase in upheld complaints. I owned the problem framing, workshop design and pilot review; the engineering team built the integration.

Interviewer: Describe a workshop or learning programme you designed and facilitated.
Applicant: I created a six-session internal programme for 32 managers on testing digital service ideas. Participants brought a real process, interviewed users and presented an experiment. Twenty-seven completed the programme and 11 teams ran a pilot within three months. I used feedback forms and project reviews, although I did not run a formal assessment of learning.

Interviewer: How have you turned an ambiguous industry problem into an applied project?
Applicant: A social-service partner asked us to improve access but did not have a defined product request. I helped staff and volunteers narrow the issue to missed appointment reminders, then scoped a four-week prototype with consent and escalation rules. The partner tested it at one centre and reported fewer manual reminder calls. We did not obtain reliable long-term outcome data, so I would not claim that the project improved attendance.

Interviewer: Give an example of building a partnership.
Applicant: I convened a bank, a community organisation and a small software company around a digital inclusion pilot. I wrote the shared brief, clarified what data would not be exchanged and ran fortnightly decisions. The pilot supported 84 participants, and the community organisation continued the workshops for a second cycle.

Interviewer: How have you mentored someone through a difficult challenge?
Applicant: I mentored two new product managers through stakeholder interviews and pilot reviews. One later led her own cross-functional pilot. My evidence is her project outcome and feedback from her manager; I have not yet developed a structured mentoring curriculum.

Interviewer: Which parts of this role require development?
Applicant: I have not taught a semester-long university course, supervised academic research or published on AI governance. I would need curriculum mentorship, stronger assessment design and collaboration with faculty who have deeper governance expertise.`,
  feedback: `**Capabilities supported by examples:** Daniel has evidence of leading a bounded AI-enabled workflow pilot, facilitating adult learning, framing applied projects and coordinating cross-sector partners.
**Self-reported capability needing verification:** His readiness to design and teach a complete university elective has not yet been demonstrated.
**Missing evidence:** The initial interview does not establish formal learning assessment, semester-long teaching, academic contribution or sustained partnership outcomes.
**Development needs:** Curriculum and assessment design, experience with university teaching, and deeper evidence in responsible AI and governance.`,
  initialCandidateProfile: `# Initial Candidate Profile

## CAPABILITIES SUPPORTED BY EXAMPLES
- **AI-enabled transformation:** Led problem framing and review design for an eight-week customer-enquiry pilot involving 1,200 enquiries. Engineering built the integration and compliance approved the controls.
- **Applied facilitation:** Designed a six-session programme for 32 managers; 27 completed it and 11 teams began pilots within three months.
- **Partnership building:** Coordinated a bank, community organisation and software company around a pilot serving 84 participants.
- **Project framing:** Turned an unclear service-access problem into a bounded prototype with consent and escalation rules.

## SELF-REPORTED — NEEDS VERIFICATION
- Readiness to design and deliver a complete university elective.
- Ability to translate professional facilitation into assessed undergraduate learning.
- Strength and currency of the professional network available for student projects.

## MISSING EVIDENCE
- Semester-long university teaching and formal learning assessment.
- Academic research supervision or publication.
- Sustained outcomes from industry partnerships.
- Specialist depth in responsible AI and AI governance.

## CURRENT READINESS
Daniel offers relevant practitioner experience and credible facilitation evidence. The evidence supports further consideration for a practice-track contribution, while leaving meaningful teaching and subject-depth questions for follow-up.`,
  followupQuestions: [
    'What would students produce in the elective, and how would you assess whether they can apply what they learned?',
    'Which parts of your proposed elective could you teach independently today, and where would you seek faculty support?',
    'What did the partnership continue after the pilot, and what evidence can you verify?',
    'How have you handled risk, consent or governance in an AI-related project?',
  ],
  followupTranscript: `Interviewer: What would students produce in the elective, and how would you assess learning?
Applicant: I would ask teams to diagnose a real organisational workflow, identify where AI is and is not appropriate, prototype one intervention and defend the trade-offs. Assessment could combine an individual decision memo, evidence from user research and a team presentation. I have used these outputs in professional workshops, but I would want an experienced faculty member to review the academic standard and grading rubric.

Interviewer: Which parts could you teach independently today?
Applicant: I could independently teach problem framing, stakeholder discovery, service experimentation and the operating changes around AI adoption. I would co-develop technical model evaluation and AI governance sessions with specialist faculty until I had stronger subject evidence.

Interviewer: What happened after the partnership pilot?
Applicant: The community organisation ran a second workshop cycle using the facilitator guide. I can verify the 84 participants in the first cycle and the continuation through the project close-out report. I cannot verify longer-term participant outcomes.

Interviewer: How have you handled AI risk or consent?
Applicant: In the customer enquiry pilot, I worked with compliance to exclude sensitive cases, require a staff member to approve every response and log overrides for weekly review. I contributed the workflow and escalation design; legal and compliance owners approved the controls.`,
  initialResume: `# Daniel Tan
Singapore · daniel.tan@example.com · +65 8123 4567

## CONTRIBUTION PROFILE
Transformation and programme lead with experience connecting organisational needs, applied AI pilots, adult learning and cross-sector collaboration. Brings evidence from professional practice and is developing the formal teaching and assessment experience required for a university faculty role.

## RELEVANT EXPERIENCE
**Transformation Lead — Meridian Services** | 2019–Present
- Led discovery and an eight-week AI-assisted customer enquiry pilot across operations, product and compliance.
- Interviewed 18 frontline staff and designed human-review and escalation rules.
- Pilot reduced average handling time from 14 to 9 minutes across 1,200 enquiries, with no increase in upheld complaints reported by the quality team.
- Designed and facilitated a six-session service experimentation programme for 32 managers; 27 completed it and 11 teams launched pilots within three months.

**Innovation Programme Manager — Civic Bridge** | 2015–2019
- Convened a bank, community organisation and software company for a digital inclusion pilot serving 84 participants.
- Framed an ambiguous access problem into a four-week appointment-reminder prototype with consent and escalation rules.
- Mentored two product managers through stakeholder research and pilot reviews.

## EDUCATION
MBA, Strategy and Innovation — National University of Singapore | 2016
BSc, Communications and New Media — National University of Singapore | 2010

## RELEVANT CAPABILITIES
Digital transformation · Service design · Workshop facilitation · Stakeholder engagement · Product strategy · Applied generative AI prototyping`,
  finalResume: `# Daniel Tan
Singapore · daniel.tan@example.com · +65 8123 4567 · linkedin.com/in/daniel-tan-demo

## CONTRIBUTION SUMMARY
Practice-based transformation leader who can connect live organisational problems with applied learning in business and AI. Offers evidence in cross-functional AI pilots, facilitation, stakeholder discovery and industry partnerships. Ready to teach problem framing, service experimentation and AI adoption practice, while developing university assessment experience and deeper AI governance expertise with faculty colleagues.

## RELEVANT EXPERIENCE
**Transformation Lead — Meridian Services** | 2019–Present
- Led discovery and an eight-week AI-assisted customer enquiry pilot across operations, product and compliance.
- Interviewed 18 frontline staff, framed the workflow and co-designed human-review controls; engineering built the integration and compliance approved the controls.
- Reduced average handling time from 14 to 9 minutes across 1,200 pilot enquiries, with no increase in upheld complaints reported by the quality team.
- Designed a six-session service experimentation programme for 32 managers; 27 completed it and 11 teams launched pilots within three months.

**Innovation Programme Manager — Civic Bridge** | 2015–2019
- Convened a bank, community organisation and software company around a digital inclusion pilot serving 84 participants.
- Produced the shared brief, data boundaries and fortnightly decision process; the community organisation continued the workshops for a second cycle.
- Converted an ambiguous service-access challenge into a four-week appointment-reminder prototype while avoiding unsupported claims about attendance outcomes.
- Mentored two product managers through stakeholder interviews and pilot reviews.

## PROPOSED TEACHING CONTRIBUTION
- Applied elective built around organisational workflow diagnosis, responsible AI opportunity selection, user research, prototyping and trade-off decisions.
- Proposed assessment evidence: an individual decision memo, documented user research and a team presentation.
- Can independently teach problem framing, stakeholder discovery, service experimentation and AI adoption practice.

## EDUCATION
MBA, Strategy and Innovation — National University of Singapore | 2016
BSc, Communications and New Media — National University of Singapore | 2010

## DEVELOPMENT PLAN
- Co-design the first grading rubric with experienced faculty and review student work against agreed learning outcomes.
- Contribute to a specialist-led responsible AI module while building documented governance cases from practice.
- Gather teaching evaluations and assessed student work before claiming demonstrated university teaching effectiveness.`,
  updatedCandidateProfile: `# Candidate Profile After Follow-up

## CAPABILITIES SUPPORTED BY EXAMPLES
- **AI-enabled transformation:** Led discovery, workflow framing and human-review design for a measured pilot; accurately distinguishes his contribution from engineering and compliance ownership.
- **Applied teaching design:** Proposed concrete student outputs: an individual decision memo, documented user research and a team presentation.
- **Responsible implementation:** Described exclusion rules, staff approval, override logging and escalation in an AI-assisted workflow.
- **Industry collaboration:** Verified first-cycle participation and continuation into a second workshop cycle without claiming unmeasured long-term outcomes.

## CAPABILITIES PARTIALLY SUPPORTED
- **Course design:** The proposed elective structure is plausible and grounded in professional practice, but it has not been delivered or assessed in a university setting.
- **Mentoring:** Two workplace examples support practical mentoring; there is no evidence yet of sustained student supervision.

## REMAINING GAPS
- Semester-long university teaching and validated student-learning outcomes.
- Academic research supervision and publication.
- Independent specialist depth in AI governance.

## DEVELOPMENT PRIORITIES
- Co-design a grading rubric with experienced faculty and review real student work against agreed outcomes.
- Teach alongside a responsible-AI specialist while documenting cases from practice.
- Collect teaching evaluations and assessed outputs before making claims about university teaching effectiveness.

## EVIDENCE NOTE
The follow-up clarified existing capability; answering additional questions did not itself demonstrate newly acquired teaching or governance skills.`,
} as const;
