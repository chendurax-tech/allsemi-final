import React from 'react';
import { formsApi } from '../../lib/api/public.js';
import { useForm } from './useForm.js';
import { required, email, phone, numberBetween, accepted } from './validation.js';
import { FormSection, TextField, TextArea, SelectField, ChoiceGroup, Checkbox, Honeypot } from './fields.jsx';
import { FileDropZone } from './FileDropZone.jsx';
import { FormAlert, SubmitButton, SuccessPanel, TEXT_ACTION } from './FormStatus.jsx';
import { useDomainOptions, HIRING_TYPE_OPTIONS, WORK_MODE_OPTIONS } from './options.js';

/*
  RequirementForm - the "Hire Talent" form on the Contact page
  (?type=employer). It sends a hiring requirement to POST
  /api/requirements through formsApi.submitRequirement, with an
  optional job description attached as `attachment`.

  The fields and their limits are the ones the backend's
  requirementFormSchema accepts. Nothing internal (status, priority,
  source) is sent; the server sets those itself.
*/

const INITIAL = {
  website: '',
  contactName: '',
  company: '',
  email: '',
  phone: '',
  hiringType: '',
  domain: '',
  role: '',
  positions: '1',
  location: '',
  workMode: '',
  description: '',
  consent: false,
};

const SCHEMA = {
  contactName: { label: 'Your name', rules: [required('Enter your name.')] },
  company: { label: 'Company', rules: [required('Enter your company name.')] },
  email: { label: 'Work email', rules: [required('Enter your work email.'), email()] },
  phone: { label: 'Phone', rules: [phone()] },
  hiringType: { label: 'Hiring type' },
  role: { label: 'Role or roles', rules: [required('Enter the role or roles you are hiring for.')] },
  domain: { label: 'Engineering domain' },
  positions: { label: 'Number of positions', rules: [numberBetween(1, 999, { whole: true })] },
  location: { label: 'Work location' },
  workMode: { label: 'Work mode' },
  description: { label: 'About the requirement' },
  consent: { label: 'Consent', rules: [accepted()] },
};

const FILE = { name: 'attachment', label: 'Job description' };

export default function RequirementForm({ onSentChange }) {
  const form = useForm({ initial: INITIAL, schema: SCHEMA, file: FILE, onSentChange });
  const domainOptions = useDomainOptions(form.values.domain);

  function onSubmit(event) {
    event.preventDefault();
    form.submit((options) => formsApi.submitRequirement(form.values, form.file, options));
  }

  if (form.sent) {
    return (
      <SuccessPanel title="Requirement received." received="Your hiring requirement has been received." email={form.values.email.trim()}>
        <button type="button" onClick={form.reset} className={TEXT_ACTION}>&larr; Send another requirement</button>
      </SuccessPanel>
    );
  }

  return (
    <form ref={form.rootRef} onSubmit={onSubmit} noValidate className="space-y-12">
      <Honeypot field={form.field('website')} />

      <FormSection num="01" title="Contact">
        <TextField field={form.field('contactName')} label="Your name" required autoComplete="name" maxLength={120} />
        <TextField field={form.field('company')} label="Company" required autoComplete="organization" maxLength={160} />
        <TextField field={form.field('email')} label="Work email" type="email" required autoComplete="email" maxLength={254} />
        <TextField field={form.field('phone')} label="Phone" type="tel" autoComplete="tel" maxLength={25} />
      </FormSection>

      <FormSection num="02" title="Requirement">
        <ChoiceGroup field={form.field('hiringType')} label="Hiring type" options={HIRING_TYPE_OPTIONS} className="sm:col-span-2" />
        <TextField
          field={form.field('role')}
          label="Role or roles"
          required
          maxLength={300}
          placeholder="e.g. Senior RTL Design Engineer"
          className="sm:col-span-2"
        />
        <SelectField field={form.field('domain')} label="Engineering domain" options={domainOptions} placeholder="Select a domain" />
        <TextField field={form.field('positions')} label="Number of positions" type="number" min={1} max={999} step={1} inputMode="numeric" />
      </FormSection>

      <FormSection num="03" title="Details">
        <TextField field={form.field('location')} label="Work location" maxLength={160} placeholder="e.g. Bengaluru" className="sm:col-span-2" />
        <ChoiceGroup field={form.field('workMode')} label="Work mode" options={WORK_MODE_OPTIONS} className="sm:col-span-2" />
        <TextArea
          field={form.field('description')}
          label="About the requirement"
          maxLength={6000}
          hint="Team, technical scope, experience level, anything that helps us understand the role."
          className="sm:col-span-2"
        />
        <FileDropZone field={form.fileField} label="Job description" optional className="sm:col-span-2" />
      </FormSection>

      <div className="space-y-6">
        <Checkbox field={form.field('consent')} required>
          I agree to ALLSEMIS storing these details to respond to this requirement.
        </Checkbox>
        {form.alert && <FormAlert alert={form.alert} />}
        <SubmitButton sending={form.sending}>Send requirement</SubmitButton>
      </div>
    </form>
  );
}
