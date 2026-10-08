import { test } from 'node:test';
import assert from 'node:assert/strict';

/*
  The deterministic resume parser (services/resume/resumeParser.js) and
  the skill taxonomy (services/resume/skillTaxonomy.js). Pure functions:
  no database, no network, no model. Every resume here is invented.
*/
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-0123456789-abcdefghij';

const { parseResume, parseDate, findDateRange, splitSections, PARSER_VERSION } = await import('../src/services/resume/resumeParser.js');
const { findSkills, normaliseSkill, normaliseSkills, createSkillMatcher, skillKey, SKILLS } = await import('../src/services/resume/skillTaxonomy.js');
const { skillKey: atsSkillKey } = await import('../src/services/atsService.js');
const { extractTextFromBuffer } = await import('../src/services/resume/textExtractor.js');
const { samplePdf } = await import('../src/seed/samplePdf.js');

// Ongoing jobs are counted up to this date.
const NOW = new Date(Date.UTC(2026, 9, 1)); // October 2026
const parse = (text, options = {}) => parseResume(text, { now: NOW, ...options });
const codes = (result) => result.warnings.map((warning) => `${warning.field}:${warning.code}`);

const VLSI_RESUME = `ASHA VERMA
Senior Design Verification Engineer
Bengaluru, Karnataka | asha.verma@example.com | +91 98765 43210 | linkedin.com/in/ashaverma

PROFESSIONAL SUMMARY
Design verification engineer with 8+ years of experience in SoC and IP verification.

TECHNICAL SKILLS
Languages: SystemVerilog, Verilog, C, Python, Perl
Methodologies: UVM, SVA, Functional Coverage, Constrained Random
Tools: Synopsys VCS, Verdi, Cadence Xcelium, JasperGold
Protocols: AXI4, AHB, APB, PCIe Gen4

WORK EXPERIENCE
Senior Verification Engineer | Example Silicon Pvt Ltd | Jan 2021 – Present
• Built a UVM testbench for a PCIe Gen4 controller and closed functional coverage.
• Wrote SystemVerilog assertions for AXI interconnect checks.
Verification Engineer | Sample Semiconductors | Jul 2018 – Dec 2020
• Verified a DDR4 memory controller using constrained random stimulus.
• Automated regressions with Python and Jenkins CI.

PROJECTS
AXI Crossbar Verification
• Developed scoreboard and coverage model for a 4x4 AXI crossbar.
Tools: VCS, UVM, Python

EDUCATION
B.Tech in Electronics and Communication Engineering, NIT Trichy, 2018, CGPA: 8.6/10

CERTIFICATIONS
• Cadence Certified Xcelium Simulator User
`;

// ------------------------------------------------------------ resumes

test('parser: a normal resume gives a full draft profile with evidence and confidence', () => {
  const result = parse(`Meera Nair
Software Engineer
Chennai, India
meera.nair@example.com | Phone: +91 91234 56789

Summary
Software engineer with 3 years of experience building backend services.

Skills
Python, Java, SQL, Docker, Git, Linux

Experience
Software Engineer at Example Software Services (Aug 2023 - Present)
- Built REST services in Java and Python.
Associate Software Engineer at Sample Technologies (Jul 2022 - Jul 2023)
- Maintained SQL reports.

Education
Bachelor of Engineering in Computer Science, Anna University College of Engineering, 2022
`);
  assert.equal(result.parserVersion, PARSER_VERSION);
  const { fields } = result;
  assert.deepEqual([fields.name.value, fields.name.confidence], ['Meera Nair', 'high']);
  assert.deepEqual(fields.name.evidence, ['Meera Nair']);
  assert.deepEqual([fields.email.value, fields.email.confidence], ['meera.nair@example.com', 'high']);
  assert.deepEqual([fields.phone.value, fields.phone.confidence], ['+91 91234 56789', 'high']);
  assert.equal(fields.location.value, 'Chennai, India');
  assert.equal(fields.headline.value, 'Software Engineer');
  assert.equal(fields.headline.confidence, 'high', 'the header title matches the current job');
  assert.deepEqual(fields.skills.value, ['Python', 'Java', 'SQL', 'Docker', 'Git', 'Linux']);
  assert.equal(fields.skills.confidence, 'high');

  const jobs = fields.experience.value;
  assert.equal(jobs.length, 2);
  assert.deepEqual([jobs[0].title, jobs[0].employer, jobs[0].period, jobs[0].current], ['Software Engineer', 'Example Software Services', 'Aug 2023 - Present', true]);
  assert.deepEqual(jobs[0].highlights, ['Built REST services in Java and Python.']);
  assert.deepEqual([jobs[1].title, jobs[1].employer], ['Associate Software Engineer', 'Sample Technologies']);
  assert.equal(jobs[1].confidence, 'high');

  // Stated 3 years; the periods add up to Jul 2022 - Oct 2026.
  assert.equal(fields.experienceYears.value, 3);
  assert.equal(fields.experienceYears.computed, 4.3);
  assert.ok(codes(result).includes('experienceYears:MISMATCH'), 'the two totals disagree and the recruiter is told');

  assert.deepEqual(fields.education.value.map((entry) => [entry.degree, entry.institution, entry.year]), [
    ['Bachelor of Engineering in Computer Science', 'Anna University College of Engineering', '2022'],
  ]);
});

test('parser: a semiconductor / VLSI resume', () => {
  const { fields, warnings } = parse(VLSI_RESUME);
  assert.equal(fields.name.value, 'Asha Verma', 'a name in capitals is given in title case');
  assert.equal(fields.location.value, 'Bengaluru, Karnataka');
  assert.equal(fields.headline.value, 'Senior Design Verification Engineer');

  // Written as the resume writes them, named as the taxonomy names them.
  for (const name of ['SystemVerilog', 'Verilog', 'C', 'Python', 'Perl', 'UVM', 'Assertions', 'Functional Coverage', 'Constrained Random Verification', 'VCS', 'Verdi', 'Xcelium', 'JasperGold', 'AXI', 'AHB', 'APB', 'PCIe', 'DDR', 'Jenkins']) {
    assert.ok(fields.skills.value.includes(name), `${name} is found`);
  }
  const details = Object.fromEntries(fields.skills.details.map((item) => [item.name, item]));
  assert.equal(details.Assertions.source, 'skills', 'SVA in the skills section');
  assert.equal(details.Assertions.confidence, 'high');
  assert.equal(details.DDR.source, 'experience', 'DDR4 only in a job');
  assert.equal(details.DDR.confidence, 'medium');
  assert.equal(details.VCS.category, 'eda');
  assert.ok(fields.skills.value.indexOf('PCIe') < fields.skills.value.indexOf('DDR'), 'skills-section skills first');

  assert.equal(fields.experience.value.length, 2);
  assert.deepEqual(fields.experience.value.map((job) => job.employer), ['Example Silicon Pvt Ltd', 'Sample Semiconductors']);
  assert.equal(fields.experience.confidence, 'high');
  // Jul 2018 - Dec 2020 (30 months) + Jan 2021 - Oct 2026 (70 months).
  assert.equal(fields.experienceYears.computed, 8.3);
  assert.deepEqual([fields.experienceYears.value, fields.experienceYears.confidence, fields.experienceYears.method], [8, 'high', 'stated']);

  assert.deepEqual(fields.education.value.map((entry) => [entry.degree, entry.institution, entry.year, entry.score]), [
    ['B.Tech in Electronics and Communication Engineering', 'NIT Trichy', '2018', '8.6/10'],
  ]);
  assert.deepEqual(fields.qualifications.value.map((item) => item.name), ['Cadence Certified Xcelium Simulator User']);
  assert.deepEqual(fields.projects.value.map((project) => [project.name, project.technologies]), [
    ['AXI Crossbar Verification', ['VCS', 'UVM', 'Python', 'AXI']],
  ]);
  assert.deepEqual(warnings, [], 'nothing is uncertain in this resume');
});

test('parser: different section headings are recognised', () => {
  const result = parse(`Rahul K. Menon
Embedded Software Engineer
Pune, India
Email: rahul.menon@example.org
Mobile: 9876501234

Career Objective
Embedded engineer with over 6 years of experience building automotive ECU firmware.

Core Competencies:
Embedded C, AUTOSAR, FreeRTOS

Employment History
Bosch Example Technologies Pvt. Ltd.
Senior Embedded Software Engineer
06/2022 - till date
- Developed AUTOSAR BSW modules in Embedded C for CAN and LIN communication.
Example Motors
Embedded Engineer
03/2020 - 05/2022
- Wrote device drivers for SPI, I2C and UART peripherals.

Academic Projects
1. Smart Parking System (2019)
Built with Arduino and ultrasonic sensors.

Educational Qualifications
Bachelor of Engineering in Electronics
Pune Institute of Computer Technology
2016 - 2020

Licenses & Certifications
ISO 26262 Functional Safety Engineer (TÜV)
`);
  assert.deepEqual(result.sections.map((section) => section.key), ['summary', 'skills', 'experience', 'projects', 'education', 'qualifications']);
  const { fields } = result;
  assert.deepEqual(fields.skills.value.slice(0, 3), ['Embedded C', 'AUTOSAR', 'FreeRTOS']);
  assert.deepEqual(fields.experience.value.map((job) => [job.title, job.employer, job.period]), [
    ['Senior Embedded Software Engineer', 'Bosch Example Technologies Pvt. Ltd.', '06/2022 - till date'],
    ['Embedded Engineer', 'Example Motors', '03/2020 - 05/2022'],
  ], 'employer and role on the two lines above the period');
  assert.deepEqual(fields.projects.value.map((project) => [project.name, project.period]), [['Smart Parking System', '2019']]);
  assert.deepEqual(fields.education.value.map((entry) => [entry.degree, entry.institution, entry.year]), [
    ['Bachelor of Engineering in Electronics', 'Pune Institute of Computer Technology', '2020'],
  ]);
  assert.equal(fields.qualifications.value.length, 1);
  assert.equal(fields.experienceYears.value, 6);

  // A heading with its content on the same line, and a skill group
  // inside a skills section that is not a new section.
  const inline = splitSections([
    { text: 'Technical Skills: Verilog, UVM', index: 0 },
    { text: 'Languages', index: 1 },
    { text: 'Python, Perl', index: 2 },
    { text: 'Hobbies', index: 3 },
    { text: 'Chess', index: 4 },
  ]);
  assert.deepEqual(inline.map((section) => [section.key, section.lines.map((line) => line.text)]), [
    ['header', []],
    ['skills', ['Verilog, UVM', 'Languages', 'Python, Perl']],
    ['other', ['Chess']],
  ]);
});

test('parser: missing sections leave fields empty with a warning, never invented', () => {
  const result = parse(`Karthik Rao
karthik.rao@example.com

Work Experience
Design Engineer | Example Devices Ltd | Feb 2022 - Present
- RTL design of AHB peripherals in Verilog.
`);
  const { fields } = result;
  assert.deepEqual(fields.education.value, []);
  assert.equal(fields.education.confidence, null);
  assert.deepEqual(fields.projects.value, []);
  assert.deepEqual(fields.qualifications.value, []);
  assert.equal(fields.phone.value, '');
  assert.equal(fields.location.value, '');
  for (const code of ['education:NOT_FOUND', 'projects:NOT_FOUND', 'qualifications:NOT_FOUND', 'phone:NOT_FOUND', 'location:NOT_FOUND', 'skills:NO_SECTION']) {
    assert.ok(codes(result).includes(code), code);
  }
  // Skills are still read from the job, at a lower confidence.
  assert.deepEqual(fields.skills.value, ['RTL Design', 'AHB', 'Verilog']);
  assert.equal(fields.skills.confidence, 'medium');
  // The headline comes from the current job when the header has none.
  assert.deepEqual([fields.headline.value, fields.headline.source, fields.headline.confidence], ['Design Engineer', 'experience', 'medium']);
});

// ---------------------------------------------------------------- dates

test('parser: different date formats are read', () => {
  const cases = [
    ['Jan 2020 - Present', { year: 2020, month: 1 }, null],
    ['January, 2019 – March 2021', { year: 2019, month: 1 }, { year: 2021, month: 3 }],
    ["Mar'18 to Jun'20", { year: 2018, month: 3 }, { year: 2020, month: 6 }],
    ['06/2019 - 03/2022', { year: 2019, month: 6 }, { year: 2022, month: 3 }],
    ['2019.06 - 2023.03', { year: 2019, month: 6 }, { year: 2023, month: 3 }],
    ['2018 – 2021', { year: 2018, month: null }, { year: 2021, month: null }],
    ['2019-2023', { year: 2019, month: null }, { year: 2023, month: null }],
    ['Sept 2017 - Current', { year: 2017, month: 9 }, null],
    ['May 2015 – Till Date', { year: 2015, month: 5 }, null],
    ['Oct. 2016 ~ Nov. 2018', { year: 2016, month: 10 }, { year: 2018, month: 11 }],
    ['from 2020 to 2022', { year: 2020, month: null }, { year: 2022, month: null }],
    ['Since Aug 2021', { year: 2021, month: 8 }, null],
  ];
  for (const [text, start, end] of cases) {
    const range = findDateRange(`Engineer | Example Ltd | ${text}`);
    assert.ok(range, `${text} is a period`);
    assert.deepEqual(range.start, start, `${text}: start`);
    assert.deepEqual(range.end, end, `${text}: end`);
    assert.equal(range.ongoing, end === null, `${text}: ongoing`);
  }
  // Not periods.
  for (const text of ['Phone: 98765-43210', 'Scored 85% in 12th', 'Version 2.0 - 3.1', 'Jan 20, 2021', '1999-12345']) {
    assert.equal(findDateRange(text), null, `${text} is not a period`);
  }
  assert.deepEqual(parseDate('Feb 2024'), { year: 2024, month: 2 });
  assert.deepEqual(parseDate('2024-02'), { year: 2024, month: 2 });
  assert.equal(parseDate('13/2024'), null);
  assert.equal(parseDate('soon'), null);
});

// --------------------------------------------------------------- skills

test('parser: skills written inside sentences are found', () => {
  const { fields } = parse(`Neha Gupta
neha.gupta@example.com

Experience
Physical Design Engineer, Example Microsystems, 2019 - 2023
Floorplanning, clock tree synthesis and routing of 7nm blocks using Cadence Innovus.
Ran static timing analysis in PrimeTime and fixed DRC/LVS violations in Calibre.
Wrote Tcl scripts to automate the flow and reduced IR drop with power grid fixes.
`);
  assert.deepEqual(fields.skills.value, ['Physical Design', 'Floorplanning', 'Clock Tree Synthesis', 'Innovus', 'STA', 'PrimeTime', 'Physical Verification', 'Calibre', 'Tcl', 'IR Drop Analysis']);
  assert.ok(fields.skills.details.every((item) => item.source === 'experience' && item.confidence === 'medium'));
  assert.ok(fields.skills.details[1].evidence.startsWith('Floorplanning, clock tree synthesis'));
});

test('parser: one skill written several ways is one skill, under its taxonomy name', () => {
  const { fields } = parse(`Skills
System Verilog, SystemVerilog, SV, systemverilog, Verilog HDL
P&R, Place and Route, PnR
Clock Domain Crossing (CDC)
Python3, python
SoC Bring-up Strategy

Experience
Engineer | Example Silicon Ltd | 2020 - 2022
Wrote SystemVerilog checkers.
`);
  assert.deepEqual(fields.skills.value, ['SystemVerilog', 'Verilog', 'Place and Route', 'CDC', 'Python']);
  const sv = fields.skills.details.find((item) => item.name === 'SystemVerilog');
  assert.equal(sv.mentions, 5, 'four spellings in the list and one in a job');
  assert.equal(sv.source, 'skills');
  assert.deepEqual(fields.skills.unrecognised, ['SoC Bring-up Strategy'], 'a listed skill the taxonomy does not know is kept as written, apart');

  assert.equal(normaliseSkill('system-verilog'), 'SystemVerilog');
  assert.equal(normaliseSkill('Static Timing Analysis'), 'STA');
  assert.equal(normaliseSkill('sva'), 'Assertions');
  assert.equal(normaliseSkill('Basket weaving'), null);
  assert.deepEqual(normaliseSkills(['SV', 'SystemVerilog', ' uvm ', 'UVM', 'Custom Flow', 'custom flow', '']), ['SystemVerilog', 'UVM', 'Custom Flow']);

  // Skills the jobs in this system ask for, beyond the taxonomy.
  const matcher = createSkillMatcher(['Sensor Calibration', 'UVM']);
  assert.deepEqual(matcher.find('Did sensor calibration with UVM').map((hit) => hit.name), ['Sensor Calibration', 'UVM']);
  const withJobs = parse('Skills\nSensor Calibration, UVM', { extraSkills: ['Sensor Calibration'] });
  assert.deepEqual(withJobs.fields.skills.value, ['Sensor Calibration', 'UVM']);
});

test('parser: words that only look like skills are not taken for skills', () => {
  const { fields } = parse(`John Smith
I can work in a team and go to market fast. Got a grade C in maths.
We had to arm ourselves with patience while R&D budgets were cut.
The assembly line used PIC boards. A formal encounter with people of calibre.
Spices were added. The sta tion was busy. Make it work, then make it fast.
Clock domain crossing (CDC) checks and JavaScript, not Java, for the dashboard.
`);
  assert.deepEqual(fields.skills.value, ['CDC', 'JavaScript', 'Java']);
  for (const name of ['CAN', 'Go', 'C', 'ARM', 'R', 'Assembly', 'Microcontrollers', 'Formality', 'Innovus', 'Calibre', 'SPICE', 'STA', 'Makefile']) {
    assert.ok(!fields.skills.value.includes(name), `${name} is not found`);
  }
  // A longer name is not split into shorter ones.
  assert.deepEqual(findSkills('SystemVerilog and C++ and Embedded C').map((hit) => hit.name), ['SystemVerilog', 'C++', 'Embedded C']);
  assert.deepEqual(findSkills('C, C++, R, Go', { list: true }).map((hit) => hit.name), ['C', 'C++', 'R', 'Go']);
  assert.deepEqual(findSkills('Node.js and JavaScript').map((hit) => hit.name), ['JavaScript']);
});

test('taxonomy: names are unique, and its skill key is the ATS skill key', () => {
  const names = SKILLS.map((entry) => entry.name);
  assert.equal(new Set(names.map(skillKey)).size, names.length, 'no two skills share a name');
  for (const value of ['System Verilog', 'C++', 'C#', 'CAN/LIN', 'Place & Route', 'RISC-V', 'I2C']) {
    assert.equal(skillKey(value), atsSkillKey(value), value);
  }
  // Each spelling belongs to one skill only.
  const owner = new Map();
  for (const entry of SKILLS) {
    for (const spelling of [...entry.aliases, ...entry.strict, ...entry.listOnly]) {
      const key = `${skillKey(spelling)}|${entry.strict.includes(spelling) || entry.listOnly.includes(spelling) ? 'case' : 'any'}`;
      assert.ok(!owner.has(key) || owner.get(key) === entry.name, `"${spelling}" belongs to both ${owner.get(key)} and ${entry.name}`);
      owner.set(key, entry.name);
    }
  }
});

// ----------------------------------------------------------- experience

test('parser: total experience counts overlaps once, leaves internships out and flags what is uncertain', () => {
  const result = parse(`Experience
Senior Engineer | Example Silicon Pvt Ltd | Jan 2022 - Present
Consultant Engineer | Sample Design Services | Jun 2021 - Jun 2022
Engineer | Example Semiconductors | Jan 2019 - Dec 2020
Design Intern | Example Labs | Jun 2018 - Dec 2018
Engineer | Broken Dates Ltd | Mar 2024 - Jan 2023
`);
  const { fields } = result;
  assert.equal(fields.experience.value.length, 5);
  assert.equal(fields.experience.value[3].internship, true);
  assert.equal(fields.experience.value[4].validPeriod, false);
  // Jan 2019 - Dec 2020 (24 months) + Jun 2021 - Oct 2026 (65 months,
  // the two overlapping jobs counted once). The internship and the
  // impossible period are not counted.
  assert.equal(fields.experienceYears.value, 7.4);
  assert.deepEqual([fields.experienceYears.method, fields.experienceYears.confidence], ['computed', 'medium']);
  assert.ok(codes(result).includes('experienceYears:INTERNSHIPS_EXCLUDED'));
  assert.ok(codes(result).includes('experience:INVALID_PERIOD'));

  // Years only: approximate, low confidence.
  const years = parse('Experience\nEngineer | Example Chips Inc | 2016 - 2020');
  assert.deepEqual([years.fields.experienceYears.value, years.fields.experienceYears.confidence], [4, 'low']);
  assert.ok(codes(years).includes('experienceYears:YEAR_ONLY_DATES'));

  // Stated in the summary, in years and months.
  const stated = parse('Summary\nTotal Experience: 5 years 6 months\n\nExperience\nEngineer | Example Chips Inc | Apr 2021 - Present');
  assert.deepEqual([stated.fields.experienceYears.value, stated.fields.experienceYears.method, stated.fields.experienceYears.confidence], [5.5, 'stated', 'high']);

  // An experience section with no periods: no jobs are made up.
  const undated = parse('Experience\nWorked at Example Silicon on verification.\nLater moved to design.');
  assert.deepEqual(undated.fields.experience.value, []);
  assert.equal(undated.fields.experienceYears.value, null);
  assert.ok(codes(undated).includes('experience:NO_DATES'));
});

test('parser: the role and the employer below the period, and unclear jobs', () => {
  const result = parse(`Experience
2019 - 2023
Physical Design Engineer, Example Microsystems
- Block-level implementation.
Since 2023
Example Chips Inc
Lead Physical Design Engineer
Mar 2015 - Feb 2016
Something Something
`);
  const jobs = result.fields.experience.value;
  assert.deepEqual(jobs.map((job) => [job.title, job.employer, job.period]), [
    ['Physical Design Engineer', 'Example Microsystems', '2019 - 2023'],
    ['Lead Physical Design Engineer', 'Example Chips Inc', 'Since 2023'],
    ['', '', 'Mar 2015 - Feb 2016'],
  ]);
  assert.equal(jobs[2].confidence, 'low');
  assert.equal(jobs[2].heading, 'Mar 2015 - Feb 2016 | Something Something', 'the raw lines are kept for the recruiter');
  assert.ok(codes(result).includes('experience:ENTRY_UNCLEAR'));
  assert.equal(result.fields.experience.confidence, 'low');
});

// ------------------------------------------------------------- projects

test('parser: projects with titles, numbering, periods, descriptions and tools', () => {
  const { fields } = parse(`Projects
Project Title: Low-Power RISC-V Core | Jan 2022 - Jun 2022
Description: Five-stage pipelined core with clock gating.
Role: RTL designer
Tools Used: Verilog, Vivado, Questa
2. UART IP Verification
• Built a UVM environment with functional coverage.
• Reached 100% code coverage.
Smart Irrigation Controller
An ESP32 based controller written in Embedded C.
`);
  const projects = fields.projects.value;
  assert.equal(projects.length, 3);
  assert.deepEqual([projects[0].name, projects[0].period, projects[0].role, projects[0].description], ['Low-Power RISC-V Core', 'Jan 2022 - Jun 2022', 'RTL designer', 'Five-stage pipelined core with clock gating.']);
  assert.deepEqual(projects[0].technologies, ['Verilog', 'Vivado', 'Questa', 'RISC-V', 'Low Power Design']);
  assert.equal(projects[0].confidence, 'high');
  assert.deepEqual([projects[1].name, projects[1].highlights.length], ['UART IP Verification', 2]);
  assert.deepEqual(projects[1].technologies, ['UART', 'Design Verification', 'UVM', 'Functional Coverage', 'Code Coverage']);
  assert.deepEqual([projects[2].name, projects[2].description], ['Smart Irrigation Controller', 'An ESP32 based controller written in Embedded C.']);
  assert.deepEqual(projects[2].technologies, ['Microcontrollers', 'Embedded C']);
  // Project tools count as skills, found in a list.
  assert.ok(fields.skills.value.includes('Questa'));
});

// ---------------------------------------------------- unusual or broken

test('parser: empty, broken or unusual text never throws and invents nothing', () => {
  const blank = parse('\n\n   \n');
  assert.deepEqual(codes(blank), ['null:NO_TEXT']);
  assert.equal(blank.fields.name.value, '');
  assert.deepEqual(blank.fields.skills.value, []);

  for (const text of [
    null,
    '@@@ ### 12345 ---- $$$ ||| ::: 2019 2020 2021',
    '\u0000\u0001\u0002 binary �� junk',
    `${'Verilog '.repeat(5000)}`,
    'Experience\n- - -\n• • •\n2019 -\n- Present',
    'EDUCATION\nEDUCATION\nSKILLS\nSKILLS',
    'Name: \nEmail: not-an-email@\nPhone: 12',
  ]) {
    const result = parse(text);
    assert.ok(Array.isArray(result.warnings), 'a result is always returned');
    assert.equal(result.fields.email.value, '');
    assert.deepEqual(result.fields.experience.value, []);
  }

  // The resume as one long line, as some PDFs come out.
  const flat = parse('Asha Verma asha@example.com +91 98765 43210 Skills: UVM, SystemVerilog Experience Engineer at Example Silicon 2019 - 2022');
  assert.equal(flat.fields.email.value, 'asha@example.com');
  assert.equal(flat.fields.phone.value, '+91 98765 43210');
  assert.ok(flat.fields.skills.value.includes('UVM'));
  assert.equal(flat.fields.name.value, '', 'no name is guessed from a run-on line');

  // A year is not a phone number, and a period is not either.
  const numbers = parse('Asha Verma\n2019 - 2023 2024\nPIN 560001');
  assert.equal(numbers.fields.phone.value, '');
});

// --------------------------------------------------- with the extractor

test('parser: the text extracted from a PDF resume is parsed', async () => {
  const pdf = samplePdf(['Asha Verma', 'Verification Engineer', 'Hyderabad, India', 'asha.verma@example.com', 'Skills', 'SystemVerilog, UVM, Python', 'Experience', 'Verification Engineer | Example Silicon Pvt Ltd | Mar 2020 - Present']);
  const extracted = await extractTextFromBuffer(pdf);
  assert.equal(extracted.status, 'EXTRACTED');
  const { fields } = parse(extracted.text);
  assert.equal(fields.name.value, 'Asha Verma');
  assert.equal(fields.location.value, 'Hyderabad, India');
  assert.deepEqual(fields.skills.value, ['SystemVerilog', 'UVM', 'Python']);
  assert.deepEqual(fields.experience.value.map((job) => [job.title, job.employer]), [['Verification Engineer', 'Example Silicon Pvt Ltd']]);
  assert.equal(fields.experienceYears.value, 6.7, 'Mar 2020 - Oct 2026, both months counted');
});
