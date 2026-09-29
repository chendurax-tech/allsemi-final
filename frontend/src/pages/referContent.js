/*
  referContent - structured, presentation-free content for the Refer
  Talent page (pages/Refer.jsx). Kept separate from JSX for the same
  reason as the other *Content.js files across this project: an admin
  panel can eventually own this copy and these field definitions
  without anyone touching the page component itself.

  No monetary reward, "refer & earn" language, or specific payout is
  included anywhere here - none has been confirmed by the client, and
  the phase brief is explicit that referral rewards should not be
  invented. If a real referral incentive is confirmed later, it is a
  content change here, not a component rewrite.
*/

export const REFER_INTRO = {
  eyebrow: 'REFER / 01',
  headline: 'Know exceptional engineering talent?',
  body: "Some of the strongest engineers we place were never actively looking - someone who already knew their work pointed us their way. If there's a semiconductor, hardware, or engineering specialist you'd genuinely vouch for, tell us about them.",
};

export const REFER_HOW_IT_WORKS = [
  {
    num: '01',
    label: 'Tell us about the talent',
    detail: 'Share a few details about the person and why you think they are a strong fit.',
  },
  {
    num: '02',
    label: 'We review the profile',
    detail: 'Our team looks at the background against the kind of roles we are actively working.',
  },
  {
    num: '03',
    label: 'Our team connects with the candidate',
    detail: 'If it looks like a genuine fit, we reach out to them directly and respectfully.',
  },
  {
    num: '04',
    label: 'Potential opportunity',
    detail: 'Where there is a real match, the referred candidate moves into our usual process.',
  },
];

export const REFERRABLE_ROLES = [
  'RTL / VLSI Engineers',
  'Design Verification Engineers',
  'Physical Design Engineers',
  'Analog / Mixed Signal Engineers',
  'Embedded Engineers',
  'Semiconductor Engineers',
  'Hardware Engineers',
  'Other specialist engineering professionals',
];

// Field definitions for the referral form. `type` maps to a small set
// of input treatments in Refer.jsx (text / email / tel / url / file /
// textarea / checkbox); nothing about validation or layout logic is
// hardcoded to a specific field name, so adding or removing a field
// later is a data change here.
export const REFERRER_FIELDS = [
  { id: 'referrerName', label: 'Your name', type: 'text', required: true },
  { id: 'referrerEmail', label: 'Your email', type: 'email', required: true },
  { id: 'referrerPhone', label: 'Your phone', type: 'tel', required: false },
];

export const CANDIDATE_FIELDS = [
  { id: 'candidateName', label: 'Candidate name', type: 'text', required: true },
  { id: 'candidateEmail', label: 'Candidate email', type: 'email', required: false },
  { id: 'candidatePhone', label: 'Candidate phone', type: 'tel', required: false },
  { id: 'currentCompany', label: 'Current company', type: 'text', required: false },
  { id: 'currentRole', label: 'Current role', type: 'text', required: false },
  { id: 'linkedin', label: 'LinkedIn URL', type: 'url', required: false },
  { id: 'resume', label: 'Resume', type: 'file', required: false },
];

export const FIT_FIELD = {
  id: 'fitReason',
  label: 'Why do you think this person is a strong fit?',
  type: 'textarea',
  required: true,
};

export const CONSENT_FIELD = {
  id: 'consent',
  label: 'I confirm the candidate knows their details are being shared with ALLSEMIS.',
  type: 'checkbox',
  required: true,
};
