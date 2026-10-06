import { escapeHtml } from '../../utils/sanitize.js';

/*
  Email templates - every message the API sends is defined here, so
  wording and layout are changed in one place and no controller builds
  an email by hand.

  Each template returns { subject, html, text }. The messages state
  only what happened; they make no claims about timelines, outcomes or
  the company.

  Two kinds of message, with different rules:
  - To the ALLSEMIS team: carries what was submitted. Every value that
    came from a form is escaped before it is placed into HTML.
  - To a candidate who was shortlisted: fixed wording, sent once per
    application by a recruiter's action (services/shortlistService.js).
  - To the person who submitted: FIXED wording only. The address was
    typed into a public form and is not verified, so the confirmation
    may reach someone who never used the site. It therefore repeats
    nothing a visitor typed (no name, subject or message), which means
    the form cannot be used to send text of someone's choosing from
    the ALLSEMIS address. A job title is the one variable, and it is
    written by staff.
*/

const BRAND = 'ALLSEMIS';

function rowsHtml(rows) {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding:6px 16px 6px 0;color:#6b6780;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
        <td style="padding:6px 0;color:#16141f;font-size:14px;vertical-align:top">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
      </tr>`)
    .join('');
}

function rowsText(rows) {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function layout({ heading, intro, rows = [], closing = '' }) {
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f3f7;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f7;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e3e0ec">
          <tr><td style="padding:20px 28px;border-bottom:1px solid #e3e0ec;font-size:13px;letter-spacing:0.14em;font-weight:bold;color:#16141f">${BRAND}</td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#16141f">${escapeHtml(heading)}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3b3850">${escapeHtml(intro)}</p>
            ${rows.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e0ec;padding-top:12px;width:100%">${rowsHtml(rows)}</table>` : ''}
            ${closing ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#3b3850">${escapeHtml(closing)}</p>` : ''}
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #e3e0ec;font-size:12px;color:#6b6780">This is an automated message from ${BRAND}.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = [heading, '', intro, rows.length ? `\n${rowsText(rows)}` : '', closing ? `\n${closing}` : '', '', `${BRAND}`]
    .filter((part) => part !== '')
    .join('\n');
  return { html, text };
}

export const templates = {
  // ---- to the ALLSEMIS team ----
  newRequirementAdmin(requirement) {
    return {
      subject: `New hiring requirement: ${requirement.role}`,
      ...layout({
        heading: 'New hiring requirement',
        intro: 'An employer sent a requirement through the Hire Talent form. Open the admin to review it.',
        rows: [
          ['Contact', requirement.contactName],
          ['Company', requirement.company],
          ['Email', requirement.email],
          ['Phone', requirement.phone],
          ['Hiring type', requirement.hiringType],
          ['Domain', requirement.domain],
          ['Roles', requirement.role],
          ['Positions', requirement.positions],
          ['Location', requirement.location],
          ['Work mode', requirement.workMode],
          ['Description', requirement.description],
          ['Attachment', requirement.attachment ? 'Yes (open it from the admin)' : ''],
        ],
      }),
    };
  },

  // The rows are what was typed into the form for this application.
  // When the address already had a candidate record, that record was
  // not changed, and the message says so.
  newApplicationAdmin({ candidate, job, application, isNewCandidate = true }) {
    const sent = application.submittedProfile || candidate;
    return {
      subject: `New application: ${sent.name || candidate.name}${job ? ` for ${job.title}` : ''}`,
      ...layout({
        heading: 'New candidate application',
        intro: isNewCandidate
          ? 'A candidate applied through the website. The resume is stored privately; open it from the admin.'
          : 'An application arrived from an email address that already has a candidate record. The existing profile was not changed. Review the details below against it in the admin.',
        rows: [
          ['Candidate', sent.name],
          ['Email', candidate.email],
          ['Phone', sent.phone],
          ['Role', job ? job.title : 'General application'],
          ['Current role', sent.headline],
          ['Domain', sent.domain],
          ['Experience', sent.experienceYears !== null && sent.experienceYears !== undefined ? `${sent.experienceYears} years` : ''],
          ['Location', sent.location],
          ['Notice period', sent.noticePeriod],
          ['Message', application.message],
        ],
      }),
    };
  },

  newEnquiryAdmin(enquiry) {
    return {
      subject: `New enquiry: ${enquiry.subject || enquiry.type}`,
      ...layout({
        heading: 'New enquiry',
        intro: 'A message was sent through the Contact page.',
        rows: [
          ['From', enquiry.name],
          ['Email', enquiry.email],
          ['Phone', enquiry.phone],
          ['Company', enquiry.company],
          ['Type', enquiry.type],
          ['Subject', enquiry.subject],
          ['Message', enquiry.message],
        ],
      }),
    };
  },

  newReferralAdmin(referral) {
    return {
      subject: `New referral: ${referral.candidateName}`,
      ...layout({
        heading: 'New referral',
        intro: 'Someone referred an engineer through the Refer page.',
        rows: [
          ['Referred by', referral.referrerName],
          ['Referrer email', referral.referrerEmail],
          ['Referrer phone', referral.referrerPhone],
          ['Relationship', referral.relationship],
          ['Candidate', referral.candidateName],
          ['Candidate email', referral.candidateEmail],
          ['Candidate phone', referral.candidatePhone],
          ['Candidate role', referral.candidateRole],
          ['Domain', referral.domain],
          ['Why this person', referral.message],
          ['Resume', referral.resume ? 'Yes (open it from the admin)' : ''],
        ],
      }),
    };
  },

  // ---- to the person who submitted (fixed wording, see the top) ----
  requirementConfirmation() {
    return {
      subject: 'We received your hiring requirement',
      ...layout({
        heading: 'Thank you.',
        intro: 'We received your hiring requirement. A member of the ALLSEMIS team will review it and contact you at this address.',
        closing: 'If you did not send this, you can ignore this message.',
      }),
    };
  },

  applicationConfirmation({ job }) {
    return {
      subject: job ? `We received your application for ${job.title}` : 'We received your application',
      ...layout({
        heading: 'Thank you.',
        intro: job
          ? `We received your application for ${job.title}. A recruiter will review it and contact you at this address if there is a fit.`
          : 'We received your application. A recruiter will review it and contact you at this address if there is a suitable role.',
        closing: 'Your resume is stored privately and is only seen by the ALLSEMIS recruitment team. If you did not send this, reply to this email to let us know.',
      }),
    };
  },

  enquiryConfirmation() {
    return {
      subject: 'We received your message',
      ...layout({
        heading: 'Thank you.',
        intro: 'We received your message and the right person will reply to this address.',
        closing: 'If you did not send this, you can ignore this message.',
      }),
    };
  },

  referralConfirmation() {
    return {
      subject: 'We received your referral',
      ...layout({
        heading: 'Thank you.',
        intro: 'We received your referral. Our team will review the profile and contact the candidate directly if it looks like a fit.',
        closing: 'If you did not send this, you can ignore this message.',
      }),
    };
  },

  // ---- to a candidate, sent by a recruiter's action ----
  // Fixed wording, like the confirmations. The job title is written by
  // staff. Nothing the candidate typed is repeated, and no timeline or
  // outcome is promised.
  shortlistNotification({ job }) {
    return {
      subject: job ? `Your application for ${job.title} has been shortlisted` : 'Your application has been shortlisted',
      ...layout({
        heading: 'You have been shortlisted.',
        intro: job
          ? `Your application for ${job.title} has been shortlisted. A member of the ALLSEMIS recruitment team will contact you at this address about the next step.`
          : 'Your application has been shortlisted. A member of the ALLSEMIS recruitment team will contact you at this address about the next step.',
        closing: 'If you did not apply, reply to this email to let us know.',
      }),
    };
  },
};
