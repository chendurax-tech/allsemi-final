import React from 'react';
import { formsApi } from '../../lib/api/public.js';
import { useForm } from './useForm.js';
import { required, email, phone } from './validation.js';
import { FormSection, TextField, TextArea, Honeypot } from './fields.jsx';
import { FileDropZone } from './FileDropZone.jsx';
import { FormAlert, SubmitButton, SuccessPanel, TEXT_ACTION } from './FormStatus.jsx';

/*
  EnquiryForm - a plain message to ALLSEMIS, sent to POST
  /api/enquiries through formsApi.submitEnquiry, with an optional
  attachment.

  `type` is the enquiry type the backend files it under: PARTNERSHIP
  or GENERAL from the Contact page's general route, HIRING or CAREER
  when an employer or a candidate chooses to send a message instead of
  the full form. The backend's enquiry schema has no consent field, so
  none is asked for.

  onSentChange (optional, here and on the other forms) tells the page
  when the form has been replaced by its confirmation.
*/

const INITIAL = { website: '', name: '', email: '', phone: '', company: '', subject: '', message: '' };

const SCHEMA = {
  name: { label: 'Name', rules: [required('Enter your name.')] },
  email: { label: 'Email', rules: [required('Enter your email address.'), email()] },
  phone: { label: 'Phone', rules: [phone()] },
  company: { label: 'Company' },
  subject: { label: 'Subject' },
  message: { label: 'Message', rules: [required('Tell us a little about what you need.')] },
};

const FILE = { name: 'attachment', label: 'Attachment' };

export default function EnquiryForm({ type, onSentChange }) {
  const form = useForm({ initial: INITIAL, schema: SCHEMA, file: FILE, onSentChange });

  function onSubmit(event) {
    event.preventDefault();
    form.submit((options) => formsApi.submitEnquiry({ ...form.values, type }, form.file, options));
  }

  if (form.sent) {
    return (
      <SuccessPanel title="Enquiry received." received="Your message has been received." email={form.values.email.trim()}>
        <button type="button" onClick={form.reset} className={TEXT_ACTION}>&larr; Send another message</button>
      </SuccessPanel>
    );
  }

  return (
    <form ref={form.rootRef} onSubmit={onSubmit} noValidate className="space-y-12">
      <Honeypot field={form.field('website')} />

      <FormSection num="01" title="Your details">
        <TextField field={form.field('name')} label="Name" required autoComplete="name" maxLength={120} />
        <TextField field={form.field('email')} label="Email" type="email" required autoComplete="email" maxLength={254} />
        <TextField field={form.field('phone')} label="Phone" type="tel" autoComplete="tel" maxLength={25} />
        <TextField field={form.field('company')} label="Company" autoComplete="organization" maxLength={160} />
      </FormSection>

      <FormSection num="02" title="Message">
        <TextField field={form.field('subject')} label="Subject" maxLength={200} className="sm:col-span-2" />
        <TextArea field={form.field('message')} label="Message" required maxLength={6000} rows={5} className="sm:col-span-2" />
        <FileDropZone field={form.fileField} label="Attachment" optional className="sm:col-span-2" />
      </FormSection>

      <div className="space-y-6">
        {form.alert && <FormAlert alert={form.alert} />}
        <SubmitButton sending={form.sending}>Send message</SubmitButton>
      </div>
    </form>
  );
}
