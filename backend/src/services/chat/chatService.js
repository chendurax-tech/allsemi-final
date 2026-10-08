import { CHAT_LIMITS } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';
import { retrieve, allSections } from './knowledgeBase.js';
import { searchJobs, findNamedJob, jobCard } from './jobSearch.js';
import { listPublishedJobs } from '../publicJobs.js';

/*
  THE PUBLIC WEBSITE ASSISTANT: "ALLSEMI Assistant".

  Fully rule-based and local: it calls no AI service and needs no API
  key. One visitor message in, one answer out. The order of work:

    1. Read the message for what is asked (intent), by rules.
       Requests for private or internal information (candidates,
       scores, notes, the database, keys, these instructions) are
       answered with a fixed refusal; there is nothing private to reach
       anyway.
    2. Collect the facts the answer rests on: published jobs from the
       database (the same list and fields as the Talent page), and the
       official ALLSEMIS knowledge (knowledgeBase.js).
    3. Put the answer together from those facts by rules. A question the
       rules cannot answer reliably gets a clear fallback (FALLBACK)
       instead of a guess.
    4. Add what the website renders: job cards and links, chosen here
       from the database.

  Nothing is stored: not the message, not the answer. The visitor's
  browser keeps the conversation and sends the last few turns and the
  jobs last shown, so "the second one" can be understood. Those are
  only used to look jobs up again among the published ones.

  A model-worded answer is future scope; see docs/API.md.
*/

// ------------------------------------------------------------- reading

const has = (pattern, text) => pattern.test(text);

// Requests for what this assistant must never give: its instructions,
// secrets, internal systems and other people's data. Narrow on purpose:
// "What is MongoDB?" or "How are applications reviewed?" are ordinary
// questions.
const RESTRICTED = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.?!]{0,40}\b(instructions?|rules?|prompts?|guidelines?|previous|above|restrictions?)\b/i,
  /\b(system|hidden|developer|initial|internal)\s+(prompt|message|instructions?|rules?)\b|\byour (prompt|instructions|configuration|config)\b/i,
  /\bapi[\s_-]*keys?\b|\bsecret keys?\b|\b(admin|recruiter|user|account) passwords?\b|\bcredentials?\b|\b(auth|access|bearer|session) tokens?\b|\.env\b|\benvironment variables?\b|\bconnection string\b/i,
  /\b(your|the|allsemis?'?s?|internal|backend)\s+(database|db)\b|\b(dump|export|print)\b[^.?!]{0,20}\b(database|db|tables?|collections?)\b/i,
  /\b(recruiter|admin|internal)\s+(notes?|comments?|panel|dashboard|login|access|data|api)\b/i,
  /\baudit\s*logs?\b|\bserver logs?\b/i,
  /\bats\b[^.?!]{0,30}\b(scores?|rankings?|results?|ranks?)\b|\b(candidates?|applicants?)\b[^.?!]{0,30}\b(scores?|rankings?|ranked|ratings?)\b/i,
  /\b(all|list|other)\s+(of\s+the\s+)?(candidates|applicants|resumes|cvs)\b|\b(show|give|send|share)\b[^.?!]{0,20}\b(candidates?|applicants?|resumes?|cvs?|applications)\b/i,
  /\bjailbreak\b|\bdeveloper mode\b|\bact as (an? )?(admin|root|system|developer)\b|\bpretend (you are|to be) (an? )?(admin|recruiter)\b/i,
];

// Questions about a particular person's application or result.
const PRIVATE = [
  /\b(application|candidate|interview|selection|hiring)\s+status\b|\bstatus of\b[^.?!]{0,30}\b(application|candidate|my)\b/i,
  /\bwho\b[^.?!]{0,20}\b(applied|got rejected|was rejected|got selected|was selected|was shortlisted|got shortlisted|got hired|was hired)\b/i,
  /\b(?:[Ii]s|[Ww]as|[Hh]as|[Dd]id)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?(['’]s)?\s+(application\s+)?(been\s+)?(rejected|selected|shortlisted|hired|accepted)\b/,
  /\bdid i (get|clear|pass|make) (it|the job|selected|shortlisted|through)\b|\bam i (selected|shortlisted|rejected|hired)\b|\bmy (application|score|result|ranking)\b(?! process)/i,
];

const GREETING = /^(hi|hii+|hello|hey|hiya|good (morning|afternoon|evening)|namaste|greetings)\b[\s!.,]*(there|allsemi|assistant)?[\s!.]*$/i;
const THANKS = /^(thanks|thank you|thx|ok(ay)?|great|cool|got it|perfect)\b[\s!.,]*(so much|a lot)?[\s!.]*$/i;
const JOB_WORDS = /\b(jobs?|openings?|roles?|positions?|vacanc(y|ies)|opportunit(y|ies)|hiring|careers?|recruiting for)\b/i;
const DO_YOU_HAVE = /\b(do you have|are there|any)\b/i;
const APPLY = /\b(apply|applying|application|applications|cv|resume|résumé)\b/i;
const AFTER_APPLY = /\b(after (i|you) apply|after applying|what happens (next|after)|next steps?|hear back)\b/i;
const CONTACT = /\b(contact|e-?mail|phone|call|reach|address|get in touch|talk to|speak (to|with))\b/i;
const COMPANY = /\b(allsemis?|your company|the company|about (you|us)|who are you|what do you do|services?|expertise|sectors?|industr(y|ies)|clients?|locations?|offices?|headquarters|ceo|founders?|owner|leadership|history|founded|why (choose|allsemi|you)|where are you|employers?|refer(ral)?|staffing|rpo)\b/i;
const SALARY = /\b(salary|salaries|pay|ctc|package|compensation|stipend|wage|lpa)\b/i;
const FOLLOW_ONE = /\b(it|that one|this one|that role|this role|that job|this job|the role|the job|that position|this position|the position|same role|same job)\b/i;
const ORDINAL = /\b(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\b|#\s?(\d)\b|\b(?:number|no\.?)\s?(\d)\b|\bjob (\d)\b/i;
const FILTER_FOLLOW = /\b(which|any)\s+(one|ones|of (them|these|those))\b|\bof (them|these|those)\b/i;
const ORDINAL_INDEX = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4 };

// The job a follow-up points at among the jobs last shown, or null.
function referredJob(message, shown, focus) {
  const ordinal = ORDINAL.exec(message);
  if (ordinal && shown.length) {
    const word = (ordinal[1] || '').toLowerCase();
    let index = null;
    if (word === 'last') index = shown.length - 1;
    else if (word) index = ORDINAL_INDEX[word];
    else index = Number(ordinal[2] || ordinal[3] || ordinal[4]) - 1;
    if (index !== null && index >= 0 && index < shown.length) return shown[index];
  }
  if (FOLLOW_ONE.test(message) || SALARY.test(message) || APPLY.test(message) || /\b(requirements?|skills?|responsibilit|details?|more about|tell me more|location|experience|eligib)/i.test(message)) {
    if (focus) return focus;
    if (shown.length === 1) return shown[0];
  }
  return null;
}

/*
  classify - { intent, job } for a message, given the jobs the visitor
  was last shown (`shown`, in order) and the one in focus.
*/
export function classify(message, { published = [], shown = [], focus = null } = {}) {
  const text = message.trim();
  if (RESTRICTED.some((pattern) => pattern.test(text))) return { intent: 'restricted' };
  if (PRIVATE.some((pattern) => pattern.test(text))) return { intent: 'private_data' };
  if (GREETING.test(text) || THANKS.test(text)) return { intent: 'greeting' };

  // "What happens after I apply?" is about the process, whichever job is
  // being talked about.
  if (AFTER_APPLY.test(text)) return { intent: 'apply', job: focus };

  const named = findNamedJob(text, published);
  const referred = named || referredJob(text, shown, focus);
  const asksJobs = JOB_WORDS.test(text) || (DO_YOU_HAVE.test(text) && !COMPANY.test(text) && !CONTACT.test(text));

  if (shown.length && FILTER_FOLLOW.test(text) && !named) return { intent: 'job_search', among: shown.map((job) => job.id) };
  if (referred && (APPLY.test(text) && !AFTER_APPLY.test(text))) return { intent: 'apply', job: referred };
  if (referred && !(asksJobs && !named && !ORDINAL.test(text) && !FOLLOW_ONE.test(text))) return { intent: 'job_detail', job: referred };
  // "How do I apply?", "Can I apply for multiple jobs?": the process,
  // not a search, even when the word "jobs" is in it.
  const aboutApplying = APPLY.test(text) && /\b(how|can i|can you|could i|may i|multiple|more than one|several|again|need|required|process|steps?|online)\b/i.test(text);
  if (asksJobs && !AFTER_APPLY.test(text) && !aboutApplying) return { intent: 'job_search' };
  if (APPLY.test(text) || AFTER_APPLY.test(text)) return { intent: 'apply', job: focus };
  if (CONTACT.test(text)) return { intent: 'contact' };
  // Pay with no job in view: the knowledge says it is not published.
  if (COMPANY.test(text) || SALARY.test(text)) return { intent: 'company' };
  return { intent: 'general' };
}

// ------------------------------------------------------------- answers

const LINKS = {
  openings: { type: 'link', label: 'Browse all openings', href: '/talent' },
  contact: { type: 'link', label: 'Contact ALLSEMIS', href: '/contact' },
  profile: { type: 'link', label: 'Send your profile', href: '/contact?type=candidate' },
  hire: { type: 'link', label: 'Hire talent', href: '/contact?type=employer' },
};

const viewAction = (card) => ({ type: 'view_job', label: `View ${card.title}`, href: card.url, jobId: card.id });
const applyAction = (card) => (card.applyUrl ? { type: 'apply', label: `Apply for ${card.title}`, href: card.applyUrl, jobId: card.id } : null);
const sourceOf = (section) => ({ title: section.title, url: section.url || null });

const HELP_LINE = 'I can help with ALLSEMI jobs, services, locations and application information.';
// The answer to a question the rules cannot answer reliably.
export const FALLBACK = `${HELP_LINE} Please ask one of these.`;

const REFUSAL = 'I can’t help with that. I only have public ALLSEMIS information: I can’t show candidates, applications, scores, recruiter notes, internal systems or my own configuration. I’m happy to help with current openings, job requirements, ALLSEMIS services or how to apply.';

function list(items, max = 8) {
  return items.slice(0, max).map((item) => `- ${item}`).join('\n');
}

function describeSearch(query) {
  const parts = [];
  if (query.topics.length) parts.push(`“${query.topics.map((topic) => topic.word).join(' ')}”`);
  if (query.level) parts.push(query.level.label);
  if (query.location) parts.push(`in ${query.location.replace(/\b\w/g, (c) => c.toUpperCase())}`);
  return parts.join(', ');
}

function jobDetailText(job, message) {
  // A question about pay only: the short, honest answer.
  if (SALARY.test(message) && !/\b(requirements?|skills?|responsibilit|details?|tell me more|about the)\b/i.test(message)) {
    return `A salary range isn’t published for ${job.title}, so I don’t want to guess. You can review the role’s requirements on its job page${job.applicationEnabled ? ' and apply there' : ''}. I can also explain the requirements if that helps.`;
  }
  const lines = [`${job.title}${job.location ? ` (${job.location})` : ''}`];
  const facts = [job.employmentType, job.experienceLevel ? `${job.experienceLevel} level` : '', job.category].filter(Boolean);
  if (facts.length) lines.push(facts.join(' · '));
  if (job.summary) lines.push('', job.summary);
  if ((job.requiredSkills || []).length) lines.push('', 'Required skills:', list(job.requiredSkills, 12));
  if ((job.preferredSkills || []).length) lines.push('', 'Preferred skills:', list(job.preferredSkills, 12));
  if ((job.responsibilities || []).length) lines.push('', 'Responsibilities:', list(job.responsibilities, 6));
  if (SALARY.test(message)) lines.push('', 'A salary range isn’t published for this role, so I don’t want to guess. The job page and the application are the best next step.');
  lines.push('', job.applicationEnabled ? 'You can apply from the job page.' : 'This position is not accepting applications at the moment.');
  return lines.join('\n');
}

// The first sections' text, as the rules-only answer to a question the
// knowledge answers.
function knowledgeText(sections, max = 2) {
  return sections.slice(0, max).map((section) => section.text).join('\n\n');
}

function respond(fields) {
  return {
    reply: fields.reply,
    intent: fields.intent,
    answerType: fields.answerType || 'official',
    mode: fields.mode || 'rules',
    jobs: fields.jobs || [],
    actions: (fields.actions || []).filter(Boolean),
    sources: fields.sources || [],
    context: fields.context,
  };
}

/*
  handleMessage - the answer to one visitor message.
    message  the visitor's text (validated)
    context  { jobIds, focusJobId }: the jobs last shown, in order, and
             the one being talked about; ids from the visitor, used
             only to look jobs up among the published ones
  The browser also sends the last few turns (`history`); the rules do
  not need them, so they are ignored.
*/
export async function handleMessage({ message, context = {} }) {
  let published;
  try {
    published = await listPublishedJobs();
  } catch (error) {
    logger.error('chat.jobs_unavailable', { errorName: error?.name || 'Error' });
    return respond({
      intent: 'job_search',
      answerType: 'limitation',
      reply: 'I’m having trouble reaching the job listings right now. You can still browse the current openings on the Talent page, or try again in a moment.',
      actions: [LINKS.openings, LINKS.contact],
      context: { jobIds: [], focusJobId: '' },
    });
  }
  const byId = new Map(published.map((job) => [job.id, job]));
  const shown = (context.jobIds || []).map((id) => byId.get(id)).filter(Boolean);
  const focus = byId.get(context.focusJobId) || null;
  const keep = { jobIds: shown.map((job) => job.id), focusJobId: focus ? focus.id : '' };
  const { intent, job, among } = classify(message, { published, shown, focus });

  // ---- fixed answers
  if (intent === 'restricted') {
    return respond({ intent, answerType: 'limitation', reply: REFUSAL, actions: [LINKS.openings, LINKS.contact], context: keep });
  }
  if (intent === 'private_data') {
    const sections = await allSections();
    const status = sections.find((section) => section.id === 'kb:status');
    return respond({
      intent,
      answerType: 'limitation',
      reply: `${status ? status.text : 'This assistant has no access to applications or candidate records.'}\n\nI can’t see or share anyone’s application or personal details here. ${HELP_LINE}`,
      actions: [LINKS.contact, LINKS.openings],
      sources: status ? [sourceOf(status)] : [],
      context: keep,
    });
  }
  if (intent === 'greeting') {
    return respond({ intent, reply: `Hello! I’m the ALLSEMI Assistant. ${HELP_LINE} What would you like to know?`, actions: [LINKS.openings], context: keep });
  }

  // ---- answers from the published jobs and the knowledge
  let knowledge = [];
  let cards = [];
  let actions = [];
  let reply = '';
  let answerType = 'official';
  let nextContext = keep;

  if (intent === 'job_search') {
    const result = await searchJobs(message, { among });
    const found = result.jobs.slice(0, CHAT_LIMITS.jobsShown);
    const what = describeSearch(result.query);
    if (found.length) {
      cards = found.map(jobCard);
      nextContext = { jobIds: found.map((item) => item.id), focusJobId: found.length === 1 ? found[0].id : '' };
      reply = `${found.length === 1 ? 'Here is the published opening' : `Here are ${result.jobs.length > found.length ? `${found.length} of the ${result.jobs.length}` : `the ${found.length}`} published openings`}${what ? ` matching ${what}` : ''}:`;
      if (result.jobs.length > found.length) reply += '\n\nThe rest are on the Talent page.';
      actions = [LINKS.openings];
    } else {
      const others = (among ? result.published.filter((item) => among.includes(item.id)) : result.published).slice(0, 3);
      cards = others.map(jobCard);
      nextContext = { jobIds: others.map((item) => item.id), focusJobId: '' };
      answerType = 'limitation';
      reply = result.total === 0
        ? 'There are no published openings right now. You can check back later, or send your profile so the team can reach you when a suitable role opens.'
        : `I couldn’t find a currently published opening matching ${what || 'that'}. ${others.length ? `Current openings include ${others.map((item) => item.title).join(', ')}.` : ''} You can browse all openings on the Talent page or send a general application.`.replace(/\s+/g, ' ').trim();
      actions = [LINKS.openings, LINKS.profile];
    }
  } else if (intent === 'job_detail') {
    const card = jobCard(job);
    cards = [card];
    nextContext = { jobIds: keep.jobIds.length ? keep.jobIds : [job.id], focusJobId: job.id };
    reply = jobDetailText(job, message);
    actions = [viewAction(card), applyAction(card)];
  } else if (intent === 'general') {
    // Nothing the rules can answer reliably: say what can be answered.
    answerType = 'limitation';
    reply = FALLBACK;
    actions = [LINKS.openings, LINKS.contact];
  } else {
    const prefer = {
      apply: AFTER_APPLY.test(message) ? ['kb:after-applying'] : (/\b(multiple|more than one|several|another|again)\b/i.test(message) ? ['kb:multiple'] : (/\b(need|information|documents?|fields?|details)\b/i.test(message) ? ['kb:apply-details'] : ['kb:apply'])),
      contact: ['db:contact'],
      company: /\b(locations?|offices?|headquarters|where are you|based)\b/i.test(message) ? ['db:locations'] : [],
    }[intent] || [];
    knowledge = await retrieve(message, { prefer });
    if (intent === 'apply' && job) {
      const card = jobCard(job);
      cards = [card];
      nextContext = { ...keep, focusJobId: job.id };
      actions = [applyAction(card) || viewAction(card)];
    }
    const unknown = knowledge[0]?.id === 'kb:not-published';
    if (intent === 'apply') {
      reply = knowledgeText(knowledge, 1);
      if (!job) actions = [LINKS.openings, LINKS.profile];
    } else if (intent === 'contact') {
      reply = knowledgeText(knowledge, 1);
      actions = [LINKS.contact];
    } else {
      if (unknown) {
        answerType = 'limitation';
        reply = `That isn’t published in the ALLSEMI information available to me, so I don’t want to guess. ${FALLBACK}`;
      } else if (!knowledge.length) {
        answerType = 'limitation';
        reply = FALLBACK;
      } else {
        reply = knowledgeText(knowledge, 1);
      }
      actions = [!unknown && knowledge[0]?.url ? { type: 'link', label: `Open ${knowledge[0].title}`, href: knowledge[0].url } : null, LINKS.openings];
    }
  }

  // The source named is the section the answer was taken from.
  const sources = ['apply', 'contact', 'company'].includes(intent) && answerType !== 'limitation' ? knowledge.slice(0, 1).map(sourceOf) : [];
  if (!actions.length && cards.length) actions = [LINKS.openings];
  return respond({ intent, answerType, reply, jobs: cards, actions, sources, context: nextContext });
}
