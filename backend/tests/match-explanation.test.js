import { test } from 'node:test';
import assert from 'node:assert/strict';

/*
  The match explanation and skill gaps (services/matchExplanation.js).
  Pure: each result here comes from the real rule-based engine
  (evaluate in services/atsService.js), so the explanation is checked
  against what the engine really writes.
*/
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-0123456789-abcdefghij';

const { evaluate } = await import('../src/services/atsService.js');
const { buildMatchExplanation, buildSkillGap, findMention } = await import('../src/services/matchExplanation.js');

const profileJob = {
  title: 'Senior Design Verification Engineer',
  category: 'Semiconductor',
  department: 'Verification',
  location: 'Bengaluru, India',
  experienceLevel: 'Senior',
  requiredSkills: [],
  preferredSkills: [],
  keywords: [],
  requirementProfile: {
    requiredSkills: ['SystemVerilog', 'UVM', 'Formal Verification'],
    preferredSkills: ['Python', 'PCIe'],
    tools: ['VCS', 'Verdi'],
    domains: ['Semiconductor'],
    minYears: 6,
    location: 'Bengaluru',
    workArrangement: 'ON_SITE',
    education: ['B.Tech'],
    certifications: [],
    constraints: [],
    niceToHave: [],
    responsibilities: [],
    weights: null,
  },
};

const strong = {
  name: 'Asha Verma',
  phone: '+91 98765 43210',
  location: 'Bengaluru, India',
  headline: 'Senior Verification Engineer',
  domain: 'Semiconductor & Chip Engineering',
  experienceYears: 8,
  skills: ['SystemVerilog', 'UVM', 'Formal Verification', 'Python', 'PCIe', 'VCS', 'Verdi'],
  noticePeriod: '30 days',
  resume: { key: 'resumes/x.pdf' },
  education: [{ degree: 'B.Tech in ECE', institution: 'NIT Trichy' }],
};

const weak = {
  name: 'Ravi Kumar',
  phone: '',
  location: 'Pune, India',
  headline: 'Embedded Software Engineer',
  domain: 'Automotive',
  experienceYears: 2,
  skills: ['SystemVerilog', 'Python', 'Embedded C'],
  noticePeriod: '',
  resume: null,
  education: [],
};

test('explanation: a complete match is laid out part by part from the engine\'s checks', () => {
  const result = evaluate(strong, profileJob);
  const explanation = buildMatchExplanation(result);
  assert.equal(explanation.totalScore, result.totalScore);
  assert.equal(explanation.totalScore, 100);
  assert.equal(explanation.band, 'Strong match');
  assert.equal(explanation.weightSource, 'PROFILE');
  assert.equal(explanation.usedRequirementProfile, true);

  assert.deepEqual(explanation.parts.map((item) => item.key), ['skills', 'experience', 'preferredSkills', 'tools', 'domain', 'location', 'completeness']);
  assert.ok(explanation.parts.every((item) => item.status === 'pass' && item.counted));
  // Each part's share of the total, as the engine adds them.
  assert.deepEqual(explanation.parts.map((item) => item.weight), [40, 20, 10, 10, 10, 5, 5]);
  assert.equal(explanation.parts.reduce((sum, item) => sum + item.share, 0), 100);
  assert.equal(Math.round(explanation.parts.reduce((sum, item) => sum + item.contribution, 0)), result.totalScore);

  // Every statement is the engine's own.
  const details = new Set(result.checks.map((check) => check.detail));
  assert.ok(explanation.parts.every((item) => details.has(item.detail)));
  assert.equal(explanation.strengths.length, 7);
  assert.deepEqual(explanation.concerns, []);
  assert.deepEqual(explanation.skills.required, { matched: ['SystemVerilog', 'UVM', 'Formal Verification'], missing: [], total: 3, applies: true });
  assert.deepEqual(explanation.skills.tools.matched, ['VCS', 'Verdi']);
  // Checks listed without a score are notes, not parts of the score.
  assert.deepEqual(explanation.notes.map((note) => note.rule), ['Education', 'Notice period']);
  assert.equal(explanation.summary[0], '100/100: Strong match.');
  assert.equal(explanation.summary[1], '3 of 3 required skills found by name.');
});

test('explanation: missing skills, tools and the failed parts', () => {
  const result = evaluate(weak, profileJob);
  const explanation = buildMatchExplanation(result);
  assert.deepEqual(explanation.skills.required, { matched: ['SystemVerilog'], missing: ['UVM', 'Formal Verification'], total: 3, applies: true });
  assert.deepEqual(explanation.skills.preferred, { matched: ['Python'], missing: ['PCIe'], total: 2, applies: true });
  assert.deepEqual(explanation.skills.tools, { matched: [], missing: ['VCS', 'Verdi'], total: 2, applies: true });
  assert.equal(explanation.summary[1], '1 of 3 required skills found by name; missing: UVM, Formal Verification.');

  const by = Object.fromEntries(explanation.parts.map((item) => [item.key, item]));
  assert.equal(by.skills.status, 'fail');
  assert.equal(by.skills.score, 33);
  assert.equal(by.tools.status, 'review');
  assert.equal(by.tools.score, 0);
  // Experience, domain and location as the engine judged them.
  assert.deepEqual([explanation.experience.status, explanation.experience.score], ['review', 33]);
  assert.equal(explanation.experience.detail, "2 years stated. The job's requirement profile asks for 6+ years.");
  assert.deepEqual([explanation.domain.status, explanation.domain.score], ['review', 0]);
  assert.deepEqual([explanation.location.status, explanation.location.score], ['review', 40]);
  assert.match(explanation.location.detail, /Pune/);
  // Profile completeness names what is missing.
  assert.equal(explanation.completeness.status, 'review');
  assert.match(explanation.completeness.detail, /phone/);
  assert.match(explanation.completeness.detail, /resume/);
  assert.deepEqual(explanation.concerns.map((item) => item.key), ['skills', 'experience', 'tools', 'domain', 'location', 'completeness']);
  assert.deepEqual(explanation.strengths, []);
  assert.equal(Math.round(explanation.parts.reduce((sum, item) => sum + item.contribution, 0)), result.totalScore);
});

test('explanation: parts that do not apply, or that the job does not count, are marked so', () => {
  const plainJob = { title: 'Embedded Engineer', category: 'Automotive', department: '', location: '', experienceLevel: 'Mid-Level', requiredSkills: [], preferredSkills: [], keywords: [], requirementProfile: null };
  const explanation = buildMatchExplanation(evaluate(weak, plainJob));
  const by = Object.fromEntries(explanation.parts.map((item) => [item.key, item]));
  assert.equal(explanation.weightSource, 'BASELINE');
  for (const key of ['skills', 'preferredSkills', 'tools', 'location']) {
    assert.equal(by[key].status, 'not_applicable', key);
    assert.equal(by[key].counted, false);
    assert.equal(by[key].contribution, 0);
  }
  assert.equal(by.tools.detail, 'Not evaluated for this job.', 'a part the engine never listed');
  assert.equal(explanation.skills.required.applies, false);
  assert.ok(explanation.notes.some((note) => note.rule === 'Required skills'), 'the engine\'s "no required skills" check is a note');
  assert.ok(explanation.notes.some((note) => note.rule === 'Location'));

  // A weight of 0 in the job's own weights: listed, not counted.
  const zero = { ...profileJob, requirementProfile: { ...profileJob.requirementProfile, weights: { skills: 50, experience: 50, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0 } } };
  const weighted = buildMatchExplanation(evaluate(weak, zero));
  const w = Object.fromEntries(weighted.parts.map((item) => [item.key, item]));
  assert.equal(weighted.weightSource, 'JOB');
  assert.deepEqual([w.skills.counted, w.experience.counted, w.tools.counted, w.location.counted], [true, true, false, false]);
  assert.equal(w.tools.score, 0, 'still scored by the engine');
  assert.deepEqual([w.skills.share, w.experience.share], [50, 50]);
  assert.ok(!weighted.concerns.some((item) => item.key === 'tools'), 'an uncounted part is not a concern');
});

test('explanation: the same result always gives the same explanation, as a document or as JSON', () => {
  const result = evaluate(weak, profileJob);
  const once = buildMatchExplanation(result);
  assert.deepEqual(buildMatchExplanation(result), once);
  assert.deepEqual(buildMatchExplanation(JSON.parse(JSON.stringify(result))), once);
  assert.deepEqual(buildMatchExplanation({ ...result, toObject: () => result }), once);
  assert.deepEqual(buildMatchExplanation({ ...result, review: { state: 'ADVANCE', stale: true, scoreAtReview: 20 } }).review, { state: 'ADVANCE', stale: true, scoreAtReview: 20 });
});

test('skill gap: required, preferred and tools, with what the resume names but the profile does not', () => {
  const result = evaluate(weak, profileJob);
  const resume = {
    text: 'Ravi Kumar\nSkills: SystemVerilog, Python, Embedded C, AUTOSAR\nBuilt a UVM testbench for a CAN controller.\nUsed formal tools and SVA assertions.\nRan Synopsys VCS regressions.',
    skills: ['SystemVerilog', 'Python', 'Embedded C', 'AUTOSAR', 'UVM', 'Assertions', 'VCS', 'CAN'],
    extractionId: 'e1',
    status: 'APPROVED',
  };
  const gap = buildSkillGap({ result, profileSkills: weak.skills, resume });

  assert.deepEqual(gap.missingRequired, [
    { skill: 'UVM', status: 'MENTIONED_IN_RESUME', label: 'Mentioned in resume but not in approved profile', evidence: 'Built a UVM testbench for a CAN controller.' },
    // "formal tools" is not "Formal Verification": no similar skill counts.
    { skill: 'Formal Verification', status: 'NOT_IN_PROFILE', label: 'Not in the approved profile', evidence: null },
  ]);
  assert.deepEqual(gap.missingPreferred.map((item) => [item.skill, item.status]), [['PCIe', 'NOT_IN_PROFILE']]);
  assert.deepEqual(gap.missingTools.map((item) => [item.skill, item.status, item.evidence]), [['VCS', 'MENTIONED_IN_RESUME', 'Ran Synopsys VCS regressions.'], ['Verdi', 'NOT_IN_PROFILE', null]]);
  assert.deepEqual(gap.counts, { missingRequired: 2, missingPreferred: 1, missingTools: 2, mentionedInResume: 2 });

  // The candidate's own skills the job does not ask for, and resume
  // skills that are in neither the profile nor the job.
  assert.deepEqual(gap.additionalProfileSkills, ['Embedded C']);
  assert.deepEqual(gap.additionalResumeSkills.map((item) => item.skill), ['AUTOSAR', 'Assertions', 'CAN']);
  assert.deepEqual(gap.resume, { checked: true, extractionId: 'e1', status: 'APPROVED' });
  assert.ok(!JSON.stringify(gap).includes('Used formal tools'), 'the resume text is not returned, only the lines that name a missing skill');

  // Without a resume, nothing is claimed about it.
  const bare = buildSkillGap({ result, profileSkills: weak.skills });
  assert.ok(bare.missingRequired.every((item) => item.status === 'NOT_IN_PROFILE'));
  assert.deepEqual(bare.resume, { checked: false, extractionId: null, status: null });
  assert.deepEqual(bare.additionalResumeSkills, []);
});

test('skill gap: a mention is the exact name, as a whole word, in any case', () => {
  assert.equal(findMention('Wrote uvm sequences', 'UVM'), 'Wrote uvm sequences');
  assert.equal(findMention('Studied UVMs and UVMx', 'UVM'), null);
  assert.equal(findMention('Formal  Verification of FIFOs', 'Formal Verification'), 'Formal  Verification of FIFOs');
  assert.equal(findMention('C++ and C# only', 'C'), null);
  assert.equal(findMention('Languages: C, C++', 'C'), 'Languages: C, C++');
  assert.equal(findMention('', 'UVM'), null);
  assert.equal(findMention('UVM', ''), null);
  assert.equal(findMention('Used a.b*c (regex) chars', 'a.b*c'), 'Used a.b*c (regex) chars');
});
