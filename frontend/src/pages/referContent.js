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

// Field definitions for the referral form. `id` is the exact field
// name the backend's referral schema accepts (POST /api/referrals), so
// the values are sent as they are keyed here. `type` picks the input
// treatment in Refer.jsx (text / email / tel / url / select / file /
// textarea) and the matching format check; `required` fields carry the
// message shown when they are left empty. Candidate fields switch
// browser autofill off, because it would offer the referrer's own
// details. Adding or removing a field the backend accepts is a data
// change here.
export const REFERRER_FIELDS = [
  { id: 'referrerName', label: 'Your name', type: 'text', required: 'Enter your name.', maxLength: 120, autoComplete: 'name' },
  { id: 'referrerEmail', label: 'Your email', type: 'email', required: 'Enter your email address.', maxLength: 254, autoComplete: 'email' },
  { id: 'referrerPhone', label: 'Your phone', type: 'tel', maxLength: 25, autoComplete: 'tel' },
  { id: 'relationship', label: 'How you know them', type: 'text', maxLength: 160, placeholder: 'e.g. Worked on the same team' },
];

export const CANDIDATE_FIELDS = [
  { id: 'candidateName', label: 'Candidate name', type: 'text', required: 'Enter the name of the person you are referring.', maxLength: 120, autoComplete: 'off' },
  { id: 'candidateEmail', label: 'Candidate email', type: 'email', maxLength: 254, autoComplete: 'off' },
  { id: 'candidatePhone', label: 'Candidate phone', type: 'tel', maxLength: 25, autoComplete: 'off' },
  { id: 'candidateRole', label: 'Current role', type: 'text', maxLength: 160, autoComplete: 'off' },
  { id: 'candidateProfileUrl', label: 'LinkedIn or portfolio', type: 'url', maxLength: 300, placeholder: 'https://', autoComplete: 'off' },
  { id: 'domain', label: 'Engineering domain', type: 'select', placeholder: 'Select a domain' },
  { id: 'resume', label: 'Resume', type: 'file', wide: true },
];

export const FIT_FIELD = {
  id: 'message',
  label: 'Why do you think this person is a strong fit?',
  type: 'textarea',
  required: 'Tell us why you rate this person.',
  maxLength: 4000,
  wide: true,
};

export const CONSENT_FIELD = {
  id: 'consent',
  label: 'I confirm the candidate knows their details are being shared with ALLSEMIS.',
  type: 'checkbox',
  required: true,
};
