// SAMPLE DATA for the admin panel UI phase. Every candidate, application,
// requirement and enquiry below is fictional and exists only so the
// screens can be designed and reviewed before a backend is connected.
// No real person, employer or client is represented: employers and
// institutions are generic descriptors, and email addresses use the
// reserved example.com domain. Nothing here is shown on the public site.

export const APPLICATION_STATUSES = ['New', 'Screening', 'Shortlisted', 'Interview', 'Offer', 'Rejected'];
export const APPLICATION_SOURCES = ['Website', 'Referral', 'LinkedIn', 'Recruiter sourced'];
export const REQUIREMENT_PRIORITIES = ['High', 'Medium', 'Low'];
export const REQUIREMENT_STATUSES = ['Open', 'In progress', 'On hold', 'Filled'];
export const ENQUIRY_STATUSES = ['New', 'In progress', 'Closed'];
export const REVIEW_STATES = ['Pending review', 'Reviewed: advance', 'Reviewed: hold', 'Reviewed: reject'];

const edu = (degree, year) => [{ degree, institution: 'Engineering college (sample record)', year }];

export const CANDIDATES = [
  {
    id: 'cand-001', name: 'Ananya Rao', headline: 'Design Verification Engineer', location: 'Bengaluru, India',
    email: 'ananya.rao@example.com', phone: '+91 90000 00001', experienceYears: 6,
    summary: 'Verification engineer with block and SoC-level UVM experience and a record of coverage closure on digital designs.',
    skills: ['SystemVerilog', 'UVM', 'Functional Coverage', 'Assertions', 'VCS', 'Verilog', 'Python'],
    education: edu('B.E. Electronics and Communication', '2020'),
    experience: [
      { title: 'Senior Design Verification Engineer', employer: 'Fabless semiconductor company (sample)', period: '2023 to present', highlights: ['Owns UVM environments for two SoC subsystems', 'Drove functional coverage closure for a bus interface block'] },
      { title: 'Design Verification Engineer', employer: 'Semiconductor design services firm (sample)', period: '2020 to 2023', highlights: ['Built constrained-random testbenches at block level', 'Wrote assertions for protocol checking'] },
    ],
    resume: { fileName: 'ananya-rao-resume.pdf', uploadedAt: '2026-09-28T09:12:00Z', pages: 2, extraction: 'Complete' },
    source: 'Website', createdAt: '2026-09-28',
  },
  {
    id: 'cand-002', name: 'Karthik Menon', headline: 'RTL Design Engineer', location: 'Bengaluru, India',
    email: 'karthik.menon@example.com', phone: '+91 90000 00002', experienceYears: 8,
    summary: 'RTL designer covering micro-architecture through synthesis handoff, with low-power and CDC signoff experience.',
    skills: ['Verilog', 'SystemVerilog', 'RTL Design', 'Digital Logic Design', 'CDC', 'Low Power Design', 'Synthesis Constraints', 'Lint'],
    education: edu('M.Tech VLSI Design', '2018'),
    experience: [
      { title: 'Lead RTL Design Engineer', employer: 'Fabless semiconductor company (sample)', period: '2022 to present', highlights: ['Leads RTL for a peripheral subsystem from specification to synthesis handoff', 'Owns CDC and lint signoff for owned blocks'] },
      { title: 'RTL Design Engineer', employer: 'Semiconductor product company (sample)', period: '2018 to 2022', highlights: ['Implemented clock-gating and power-domain logic', 'Supported timing closure with the physical design team'] },
    ],
    resume: { fileName: 'karthik-menon-cv.pdf', uploadedAt: '2026-09-26T14:40:00Z', pages: 3, extraction: 'Complete' },
    source: 'Referral', createdAt: '2026-09-26',
  },
  {
    id: 'cand-003', name: 'Priya Nair', headline: 'Physical Design Engineer', location: 'Hyderabad, India',
    email: 'priya.nair@example.com', phone: '+91 90000 00003', experienceYears: 5,
    summary: 'Physical design engineer with block-level place and route, floorplanning and timing closure experience.',
    skills: ['Place and Route', 'STA', 'Timing Closure', 'Floorplanning', 'Innovus', 'Tcl'],
    education: edu('B.Tech Electronics and Communication', '2021'),
    experience: [
      { title: 'Physical Design Engineer', employer: 'Semiconductor design services firm (sample)', period: '2021 to present', highlights: ['Took four blocks from floorplan through routing', 'Closed setup and hold across corners at block level'] },
    ],
    resume: { fileName: 'priya-nair-resume.pdf', uploadedAt: '2026-09-29T06:05:00Z', pages: 2, extraction: 'Complete' },
    source: 'Website', createdAt: '2026-09-29',
  },
  {
    id: 'cand-004', name: 'Rohit Verma', headline: 'DFT Engineer', location: 'Bengaluru, India',
    email: 'rohit.verma@example.com', phone: '+91 90000 00004', experienceYears: 4,
    summary: 'DFT engineer focused on scan insertion and pattern generation, with memory test exposure.',
    skills: ['Scan Insertion', 'ATPG', 'MBIST', 'JTAG', 'Tessent'],
    education: edu('B.E. Electronics', '2022'),
    experience: [
      { title: 'DFT Engineer', employer: 'Semiconductor design services firm (sample)', period: '2022 to present', highlights: ['Scan insertion and ATPG for digital blocks', 'Simulated patterns and debugged mismatches'] },
    ],
    resume: { fileName: 'rohit-verma-cv.docx', uploadedAt: '2026-09-30T11:20:00Z', pages: 2, extraction: 'Needs review' },
    source: 'LinkedIn', createdAt: '2026-09-30',
  },
  {
    id: 'cand-005', name: 'Sneha Iyer', headline: 'Embedded Software Engineer', location: 'Pune, India',
    email: 'sneha.iyer@example.com', phone: '+91 90000 00005', experienceYears: 7,
    summary: 'Embedded software engineer in automotive, working on AUTOSAR-based ECUs and in-vehicle networking.',
    skills: ['Embedded C', 'C++', 'RTOS', 'Automotive Software', 'AUTOSAR', 'CAN/LIN'],
    education: edu('B.E. Electronics and Telecommunication', '2019'),
    experience: [
      { title: 'Senior Embedded Software Engineer', employer: 'Automotive supplier (sample)', period: '2022 to present', highlights: ['Developed AUTOSAR software components for a body-control ECU', 'Integrated CAN and LIN communication stacks'] },
      { title: 'Embedded Software Engineer', employer: 'Automotive engineering services firm (sample)', period: '2019 to 2022', highlights: ['Wrote RTOS-based device drivers', 'Supported hardware-in-the-loop testing'] },
    ],
    resume: { fileName: 'sneha-iyer-resume.pdf', uploadedAt: '2026-09-27T08:30:00Z', pages: 2, extraction: 'Complete' },
    source: 'LinkedIn', createdAt: '2026-09-27',
  },
  {
    id: 'cand-006', name: 'Arjun Das', headline: 'ADAS Software Engineer', location: 'Bhubaneswar, India',
    email: 'arjun.das@example.com', phone: '+91 90000 00006', experienceYears: 3,
    summary: 'Perception and sensor-fusion engineer early in an ADAS career, with a robotics background.',
    skills: ['C++', 'Python', 'Sensor Fusion', 'ROS', 'Computer Vision'],
    education: edu('M.Tech Robotics', '2023'),
    experience: [
      { title: 'ADAS Software Engineer', employer: 'Mobility technology company (sample)', period: '2023 to present', highlights: ['Implemented camera and radar fusion for object tracking', 'Built ROS-based replay tooling for recorded drives'] },
    ],
    resume: { fileName: 'arjun-das-resume.pdf', uploadedAt: '2026-10-01T05:45:00Z', pages: 1, extraction: 'Complete' },
    source: 'Website', createdAt: '2026-10-01',
  },
  {
    id: 'cand-007', name: 'Meera Krishnan', headline: 'Functional Safety Engineer', location: 'Bengaluru, India',
    email: 'meera.krishnan@example.com', phone: '+91 90000 00007', experienceYears: 9,
    summary: 'Functional safety engineer who has taken automotive systems through hazard analysis to safety case.',
    skills: ['ISO 26262', 'Functional Safety', 'Hazard Analysis', 'FMEA', 'Safety Case Documentation', 'ASIL Decomposition'],
    education: edu('B.E. Electrical and Electronics', '2017'),
    experience: [
      { title: 'Functional Safety Lead', employer: 'Automotive supplier (sample)', period: '2021 to present', highlights: ['Led hazard analysis and risk assessment for a braking subsystem', 'Authored and defended the safety case through assessment'] },
      { title: 'Safety Engineer', employer: 'Automotive engineering services firm (sample)', period: '2017 to 2021', highlights: ['Performed FMEA and FTA on ECU designs', 'Maintained safety requirement traceability'] },
    ],
    resume: { fileName: 'meera-krishnan-cv.pdf', uploadedAt: '2026-09-25T10:00:00Z', pages: 3, extraction: 'Complete' },
    source: 'Recruiter sourced', createdAt: '2026-09-25',
  },
  {
    id: 'cand-008', name: 'Vikram Shetty', headline: 'RF Systems Engineer', location: 'Bengaluru, India',
    email: 'vikram.shetty@example.com', phone: '+91 90000 00008', experienceYears: 6,
    summary: 'RF engineer with front-end design and link budget analysis experience for communications payloads.',
    skills: ['RF Design', 'Link Budget Analysis', 'Antenna Design', 'ADS/Microwave Office'],
    education: edu('M.Tech RF and Microwave Engineering', '2020'),
    experience: [
      { title: 'RF Design Engineer', employer: 'Communications hardware company (sample)', period: '2020 to present', highlights: ['Designed RF front-end chains and verified them on the bench', 'Maintained link budgets for two communication links'] },
    ],
    resume: { fileName: 'vikram-shetty-resume.pdf', uploadedAt: '2026-10-02T07:15:00Z', pages: 2, extraction: 'Complete' },
    source: 'Website', createdAt: '2026-10-02',
  },
];

export const APPLICATIONS = [
  { id: 'app-001', candidateId: 'cand-001', jobId: 'job-02', status: 'Shortlisted', source: 'Website', submittedAt: '2026-09-28', recruiterNotes: 'Strong UVM depth. Confirm notice period on first call.' },
  { id: 'app-002', candidateId: 'cand-002', jobId: 'job-01', status: 'Interview', source: 'Referral', submittedAt: '2026-09-26', recruiterNotes: 'Technical round scheduled. Referred by an engineer in the network.' },
  { id: 'app-003', candidateId: 'cand-003', jobId: 'job-04', status: 'Screening', source: 'Website', submittedAt: '2026-09-29', recruiterNotes: 'Below the stated seniority. Check full-chip exposure before deciding.' },
  { id: 'app-004', candidateId: 'cand-004', jobId: 'job-03', status: 'New', source: 'LinkedIn', submittedAt: '2026-09-30', recruiterNotes: '' },
  { id: 'app-005', candidateId: 'cand-005', jobId: 'job-05', status: 'Shortlisted', source: 'LinkedIn', submittedAt: '2026-09-27', recruiterNotes: 'Open to hybrid. Based in Pune.' },
  { id: 'app-006', candidateId: 'cand-006', jobId: 'job-06', status: 'Screening', source: 'Website', submittedAt: '2026-10-01', recruiterNotes: '' },
  { id: 'app-007', candidateId: 'cand-007', jobId: 'job-07', status: 'Offer', source: 'Recruiter sourced', submittedAt: '2026-09-25', recruiterNotes: 'Offer discussion in progress.' },
  { id: 'app-008', candidateId: 'cand-008', jobId: 'job-08', status: 'New', source: 'Website', submittedAt: '2026-10-02', recruiterNotes: '' },
  { id: 'app-009', candidateId: 'cand-001', jobId: 'job-01', status: 'Rejected', source: 'Website', submittedAt: '2026-09-28', recruiterNotes: 'Verification profile, not RTL design. Kept for the DV role.' },
  { id: 'app-010', candidateId: 'cand-005', jobId: 'job-06', status: 'New', source: 'LinkedIn', submittedAt: '2026-10-02', recruiterNotes: '' },
];

export const REQUIREMENTS = [
  { id: 'req-001', role: 'Design Verification Engineer', skills: ['SystemVerilog', 'UVM', 'Functional Coverage'], experience: '4 to 8 years', education: 'B.E. / B.Tech in Electronics or equivalent', location: 'Bengaluru', priority: 'High', status: 'In progress', openings: 3, notes: 'SoC-level experience preferred. Shortlist in progress.', createdAt: '2026-09-22' },
  { id: 'req-002', role: 'Physical Design Engineer', skills: ['Place and Route', 'STA', 'Timing Closure'], experience: '7+ years', education: 'B.E. / B.Tech or M.Tech', location: 'Bengaluru', priority: 'High', status: 'Open', openings: 2, notes: 'Full-chip or large-block experience required.', createdAt: '2026-09-24' },
  { id: 'req-003', role: 'Embedded Software Engineer', skills: ['Embedded C', 'RTOS', 'AUTOSAR'], experience: '4 to 7 years', education: 'B.E. / B.Tech', location: 'Hybrid', priority: 'Medium', status: 'In progress', openings: 2, notes: 'Automotive background required.', createdAt: '2026-09-20' },
  { id: 'req-004', role: 'Functional Safety Engineer', skills: ['ISO 26262', 'Hazard Analysis', 'FMEA'], experience: '7+ years', education: 'B.E. / B.Tech', location: 'Hybrid', priority: 'Medium', status: 'Open', openings: 1, notes: '', createdAt: '2026-09-18' },
  { id: 'req-005', role: 'RF Systems Engineer', skills: ['RF Design', 'Link Budget Analysis'], experience: '7+ years', education: 'M.Tech preferred', location: 'Bengaluru', priority: 'Low', status: 'On hold', openings: 1, notes: 'On hold until the programme start date is confirmed.', createdAt: '2026-09-12' },
];

export const ENQUIRIES = [
  { id: 'enq-001', type: 'employer', name: 'Sample Enquirer A', email: 'hiring.lead@example.com', phone: '+91 90000 10001', company: 'Employer name (sample)', subject: 'Verification team hiring', message: 'We are building a verification team and would like to discuss permanent staffing for three roles.', status: 'New', receivedAt: '2026-10-02', internalNotes: '' },
  { id: 'enq-002', type: 'candidate', name: 'Sample Enquirer B', email: 'engineer@example.com', phone: '', company: '', subject: 'Physical design roles', message: 'I have six years in physical design and would like to hear about suitable openings.', status: 'In progress', receivedAt: '2026-10-01', internalNotes: 'Asked for an updated resume.' },
  { id: 'enq-003', type: 'employer', name: 'Sample Enquirer C', email: 'talent@example.com', phone: '+91 90000 10003', company: 'Employer name (sample)', subject: 'RPO for a new design centre', message: 'We would like to understand how an RPO engagement would work for a new team.', status: 'In progress', receivedAt: '2026-09-30', internalNotes: 'Call booked.' },
  { id: 'enq-004', type: 'general', name: 'Sample Enquirer D', email: 'partner@example.com', phone: '', company: '', subject: 'Partnership', message: 'We run engineering training programmes and would like to explore working together.', status: 'New', receivedAt: '2026-09-29', internalNotes: '' },
  { id: 'enq-005', type: 'candidate', name: 'Sample Enquirer E', email: 'graduate@example.com', phone: '', company: '', subject: 'Entry-level DFT', message: 'Recent graduate with a DFT internship. Are there entry-level roles?', status: 'Closed', receivedAt: '2026-09-24', internalNotes: 'Replied with guidance. No current entry-level DFT role.' },
];

// Per-evaluation sample content. Skill matching and the rule checks are
// NOT stored here: seed.js computes them from the real job record and
// the candidate profile, the way the backend rule engine will. What is
// stored here stands in for the AI layer's output (semantic reading,
// explanation, evidence) and the recruiter's review.
export const ATS_BASE = [
  {
    id: 'ats-001', candidateId: 'cand-001', jobId: 'job-02', runAt: '2026-09-28T09:20:00Z', overall: 89,
    domain: { level: 'High', note: 'Current and previous roles are both digital design verification.' },
    education: { result: 'Match', note: 'Engineering degree in Electronics and Communication.' },
    experienceSummary: 'Six years in design verification, with block and SoC-level UVM ownership.',
    experienceGaps: [],
    strengths: ['Owns UVM environments at SoC subsystem level', 'Direct evidence of functional coverage closure', 'Assertions used for protocol checking'],
    potentialGaps: ['Resume names one simulator only', 'No formal verification experience stated'],
    semanticNote: 'Responsibilities described in the resume align closely with the role: testbench ownership, coverage closure and debug with design.',
    explanation: 'All four required skills appear in the resume with supporting detail, and the experience described matches the role scope. The preferred tools are only partly covered. Recommend a recruiter call to confirm simulator exposure and notice period.',
    evidence: [
      { claim: 'UVM environment ownership', source: 'Resume, experience, current role', excerpt: 'Owns UVM environments for two SoC subsystems' },
      { claim: 'Coverage closure', source: 'Resume, experience, current role', excerpt: 'Drove functional coverage closure for a bus interface block' },
    ],
    review: { state: 'Reviewed: advance', reviewer: 'Recruiter (sample)', note: 'Advance to first call.', updatedAt: '2026-09-28T11:02:00Z' },
  },
  {
    id: 'ats-002', candidateId: 'cand-002', jobId: 'job-01', runAt: '2026-09-26T14:48:00Z', overall: 91,
    domain: { level: 'High', note: 'Eight years of RTL design for digital ASIC and SoC blocks.' },
    education: { result: 'Match', note: 'Postgraduate degree in VLSI Design.' },
    experienceSummary: 'Eight years in RTL design, currently leading a subsystem.',
    experienceGaps: [],
    strengths: ['Specification to synthesis handoff ownership', 'CDC and lint signoff experience', 'Low-power design work'],
    potentialGaps: ['Seniority may exceed the role level'],
    semanticNote: 'The resume describes the same span of work as the role: micro-architecture, RTL, and synthesis handoff.',
    explanation: 'Required skills are fully covered and all three preferred skills are present. The candidate currently leads a subsystem, so confirm that the role scope and level are a fit before progressing.',
    evidence: [
      { claim: 'End-to-end RTL ownership', source: 'Resume, experience, current role', excerpt: 'Leads RTL for a peripheral subsystem from specification to synthesis handoff' },
      { claim: 'CDC signoff', source: 'Resume, experience, current role', excerpt: 'Owns CDC and lint signoff for owned blocks' },
    ],
    review: { state: 'Reviewed: advance', reviewer: 'Recruiter (sample)', note: 'Technical round scheduled.', updatedAt: '2026-09-27T09:30:00Z' },
  },
  {
    id: 'ats-003', candidateId: 'cand-003', jobId: 'job-04', runAt: '2026-09-29T06:12:00Z', overall: 74,
    domain: { level: 'High', note: 'Physical design is the only discipline on the resume.' },
    education: { result: 'Match', note: 'Engineering degree in Electronics and Communication.' },
    experienceSummary: 'Five years of block-level physical design.',
    experienceGaps: ['Role is set at Senior level; five years stated', 'No full-chip or top-level experience described'],
    strengths: ['Block-level flow from floorplan through routing', 'Timing closure across corners'],
    potentialGaps: ['Below the stated experience level', 'Signoff tool experience not stated'],
    semanticNote: 'The phrase "Physical Implementation" does not appear in the resume, so the exact-name rule flags it. The floorplanning and place-and-route work described is physical implementation, so the semantic comparison treats this skill as covered.',
    explanation: 'Three of four required skills match exactly and the fourth is covered in substance. The main question is seniority: the experience described is block level. Suitable for a recruiter judgement on whether the role can flex.',
    evidence: [
      { claim: 'Physical implementation in practice', source: 'Resume, experience', excerpt: 'Took four blocks from floorplan through routing' },
      { claim: 'Timing closure', source: 'Resume, experience', excerpt: 'Closed setup and hold across corners at block level' },
    ],
    review: { state: 'Pending review', reviewer: null, note: '', updatedAt: null },
  },
  {
    id: 'ats-004', candidateId: 'cand-004', jobId: 'job-03', runAt: '2026-09-30T11:31:00Z', overall: 68,
    domain: { level: 'Medium', note: 'DFT execution experience; architecture ownership not shown.' },
    education: { result: 'Match', note: 'Engineering degree in Electronics.' },
    experienceSummary: 'Four years of DFT execution: scan insertion and pattern generation.',
    experienceGaps: ['No DFT architecture definition described'],
    strengths: ['Hands-on scan insertion and ATPG', 'Pattern simulation and mismatch debug', 'Memory test exposure'],
    potentialGaps: ['DFT architecture is a required skill and is not evidenced', 'Resume extraction needs review: a table section did not parse cleanly'],
    semanticNote: 'The resume describes implementing a test strategy, not defining one.',
    explanation: 'Two of three required skills are evidenced. DFT architecture is not. Extraction flagged part of the document for review, so check the original resume before relying on this result.',
    evidence: [
      { claim: 'Scan and ATPG execution', source: 'Resume, experience', excerpt: 'Scan insertion and ATPG for digital blocks' },
    ],
    review: { state: 'Pending review', reviewer: null, note: '', updatedAt: null },
  },
  {
    id: 'ats-005', candidateId: 'cand-005', jobId: 'job-05', runAt: '2026-09-27T08:41:00Z', overall: 88,
    domain: { level: 'High', note: 'Seven years of automotive embedded software.' },
    education: { result: 'Match', note: 'Engineering degree in Electronics and Telecommunication.' },
    experienceSummary: 'Seven years of embedded software in automotive ECUs.',
    experienceGaps: [],
    strengths: ['AUTOSAR software component development', 'CAN and LIN stack integration', 'RTOS driver work'],
    potentialGaps: ['Functional safety awareness not stated'],
    semanticNote: 'Role and resume describe the same kind of work on the same kind of product.',
    explanation: 'All required skills match, with two of three preferred skills present. Location is compatible with a hybrid role. A strong candidate for recruiter review.',
    evidence: [
      { claim: 'AUTOSAR development', source: 'Resume, experience, current role', excerpt: 'Developed AUTOSAR software components for a body-control ECU' },
      { claim: 'In-vehicle networking', source: 'Resume, experience, current role', excerpt: 'Integrated CAN and LIN communication stacks' },
    ],
    review: { state: 'Reviewed: advance', reviewer: 'Recruiter (sample)', note: 'Shortlisted.', updatedAt: '2026-09-27T13:15:00Z' },
  },
  {
    id: 'ats-006', candidateId: 'cand-001', jobId: 'job-01', runAt: '2026-09-28T09:22:00Z', overall: 48,
    domain: { level: 'Medium', note: 'Same domain, different discipline: verification, not design.' },
    education: { result: 'Match', note: 'Engineering degree in Electronics and Communication.' },
    experienceSummary: 'Six years in verification. No RTL design ownership described.',
    experienceGaps: ['No RTL design or synthesis handoff experience'],
    strengths: ['Fluent in SystemVerilog and Verilog', 'Works closely with RTL designers'],
    potentialGaps: ['RTL design is the core of the role and is not evidenced', 'Language overlap overstates the fit'],
    semanticNote: 'Shared languages produce a partial keyword match, but the work described is verification. The semantic comparison rates the fit lower than the keyword overlap suggests.',
    explanation: 'Two required skills match by name, yet the resume describes a verification career. This is a discipline mismatch. The candidate is a better fit for the Design Verification Engineer role.',
    evidence: [
      { claim: 'Verification, not design', source: 'Resume, headline and experience', excerpt: 'Senior Design Verification Engineer' },
    ],
    review: { state: 'Reviewed: reject', reviewer: 'Recruiter (sample)', note: 'Wrong discipline for this role. Kept for the DV role.', updatedAt: '2026-09-28T11:05:00Z' },
  },
  {
    id: 'ats-007', candidateId: 'cand-006', jobId: 'job-06', runAt: '2026-10-01T05:52:00Z', overall: 63,
    domain: { level: 'Medium', note: 'ADAS perception work, early career.' },
    education: { result: 'Match', note: 'Postgraduate degree in Robotics.' },
    experienceSummary: 'Three years in sensor fusion and perception.',
    experienceGaps: ['Role is set at Mid-Senior level; three years stated', 'No production programme experience described'],
    strengths: ['Camera and radar fusion for object tracking', 'All three preferred skills present'],
    potentialGaps: ['Below the stated experience level', '"ADAS Systems" is not named, though the work described is ADAS'],
    semanticNote: 'The resume describes ADAS perception work without using the phrase "ADAS Systems".',
    explanation: 'Skills are relevant and the preferred list is fully covered. Experience is below the level stated. Worth a recruiter judgement if the role can take a less senior engineer.',
    evidence: [
      { claim: 'Sensor fusion', source: 'Resume, experience', excerpt: 'Implemented camera and radar fusion for object tracking' },
    ],
    review: { state: 'Pending review', reviewer: null, note: '', updatedAt: null },
  },
  {
    id: 'ats-008', candidateId: 'cand-007', jobId: 'job-07', runAt: '2026-09-25T10:10:00Z', overall: 93,
    domain: { level: 'High', note: 'Nine years of automotive functional safety.' },
    education: { result: 'Match', note: 'Engineering degree in Electrical and Electronics.' },
    experienceSummary: 'Nine years in functional safety, currently in a lead role.',
    experienceGaps: [],
    strengths: ['Led hazard analysis and risk assessment', 'Authored a safety case through assessment', 'FMEA and FTA experience'],
    potentialGaps: [],
    semanticNote: 'Role requirements and resume describe the same responsibilities at the same level.',
    explanation: 'Required and preferred skills are fully covered with direct evidence, and the experience level exceeds the requirement.',
    evidence: [
      { claim: 'Hazard analysis leadership', source: 'Resume, experience, current role', excerpt: 'Led hazard analysis and risk assessment for a braking subsystem' },
      { claim: 'Safety case ownership', source: 'Resume, experience, current role', excerpt: 'Authored and defended the safety case through assessment' },
    ],
    review: { state: 'Reviewed: advance', reviewer: 'Recruiter (sample)', note: 'Offer stage.', updatedAt: '2026-09-26T08:20:00Z' },
  },
];
