import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Button, Notice, inputCls, labelCls } from '../components/ui.jsx';

/*
  Sign-in and password screens.

  Login            the only way into the admin. There is no sign-up and
                   no password recovery here: an account is created,
                   and a forgotten password is reset, by a super admin
                   in Settings, Access.
  ChangePassword   shown instead of the admin while the account still
                   has a temporary password. The backend refuses every
                   admin request until it has been changed.
  PasswordForm     the form both that screen and the "Change password"
                   drawer in the layout use.

  The session is an HttpOnly cookie set by the backend. This file never
  sees it and stores nothing in the browser.
*/

// What a person needs to know for each refusal the sign-in endpoint
// can give. Anything else shows the message the server sent.
const SIGN_IN_PROBLEMS = {
  RATE_LIMITED: 'Too many sign-in attempts from this connection. Wait fifteen minutes, then try again.',
};

function Shell({ title, lead, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg font-body text-text">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4 md:px-8">
        <img src="/brand/allsemis-symbol-sm.png" alt="" aria-hidden="true" width={240} height={147} className="h-[18px] w-auto shrink-0" />
        <span className="font-display text-sm font-bold tracking-wide">ALLSEMIS</span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-accent">Admin</span>
        <Link to="/" className="ml-auto text-xs font-semibold text-text-dim transition-colors hover:text-accent">View site</Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <section className="w-full max-w-sm border border-line bg-bg-raised/50">
          <div className="relative border-b border-line px-5 py-5">
            <span className="absolute left-0 top-0 h-full w-0.5 bg-accent" aria-hidden="true" />
            <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{lead}</p>
          </div>
          <div className="px-5 py-5">{children}</div>
        </section>
      </main>
    </div>
  );
}

export default function Login() {
  const { login, message } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (failure) {
      setError(failure);
      setSending(false);
    }
  }

  const fields = error?.fields || {};

  return (
    <Shell title="Sign in" lead="Use the email and password of your ALLSEMIS admin account.">
      <form onSubmit={submit} noValidate>
        {message && !error && <div className="mb-4" role="status"><Notice tone="amber">{message}</Notice></div>}
        {error && <div className="mb-4" role="alert"><Notice tone="red">{SIGN_IN_PROBLEMS[error.code] || error.message}</Notice></div>}

        <label htmlFor="login-email" className={labelCls}>Email</label>
        <input id="login-email" name="email" type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fields.email)} className={inputCls} />
        {fields.email && <p className="mt-1.5 text-xs text-red-400">{fields.email}</p>}

        <label htmlFor="login-password" className={`${labelCls} mt-4`}>Password</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fields.password)} className={inputCls} />
        {fields.password && <p className="mt-1.5 text-xs text-red-400">{fields.password}</p>}

        <Button type="submit" variant="primary" className="mt-6 w-full" disabled={sending}>{sending ? 'Signing in' : 'Sign in'}</Button>
      </form>
      <p className="mt-5 text-xs leading-relaxed text-text-dim">
        Accounts are created by a super admin. If you cannot sign in, ask a super admin to reset your password.
      </p>
    </Shell>
  );
}

const PASSWORD_RULE = 'At least 12 characters, with at least one letter and one number.';

function passwordProblem(value) {
  if (value.length < 12) return 'Use at least 12 characters.';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Include at least one letter and one number.';
  return '';
}

export function PasswordForm({ currentLabel = 'Current password', submitLabel = 'Change password', onDone }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (sending) return;
    // The same rule the server applies, checked here first so a short
    // password does not cost a request. The server checks it again.
    const problem = passwordProblem(next);
    if (!current) { setError({ message: 'Enter your current password.', fields: { currentPassword: 'Required.' } }); return; }
    if (problem) { setError({ message: 'The new password does not meet the rule.', fields: { newPassword: problem } }); return; }
    if (next !== repeat) { setError({ message: 'The two new passwords are not the same.', fields: { repeat: 'Type the new password again.' } }); return; }
    setSending(true);
    setError(null);
    try {
      await changePassword(current, next);
      if (onDone) onDone();
    } catch (failure) {
      setError(failure);
      setSending(false);
    }
  }

  const fields = error?.fields || {};

  return (
    <form onSubmit={submit} noValidate>
      {error && <div className="mb-4" role="alert"><Notice tone="red">{error.message}</Notice></div>}

      <label htmlFor="password-current" className={labelCls}>{currentLabel}</label>
      <input id="password-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={Boolean(fields.currentPassword)} className={inputCls} />
      {fields.currentPassword && <p className="mt-1.5 text-xs text-red-400">{fields.currentPassword}</p>}

      <label htmlFor="password-new" className={`${labelCls} mt-4`}>New password</label>
      <input id="password-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={Boolean(fields.newPassword)} aria-describedby="password-rule" className={inputCls} />
      {fields.newPassword && <p className="mt-1.5 text-xs text-red-400">{fields.newPassword}</p>}
      <p id="password-rule" className="mt-1.5 text-xs text-text-dim">{PASSWORD_RULE}</p>

      <label htmlFor="password-repeat" className={`${labelCls} mt-4`}>New password again</label>
      <input id="password-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={Boolean(fields.repeat)} className={inputCls} />
      {fields.repeat && <p className="mt-1.5 text-xs text-red-400">{fields.repeat}</p>}

      <Button type="submit" variant="primary" className="mt-6 w-full" disabled={sending}>{sending ? 'Saving' : submitLabel}</Button>
    </form>
  );
}

export function ChangePassword() {
  const { user, logout } = useAuth();
  return (
    <Shell
      title="Change your temporary password"
      lead={`${user.name}, this account was given a temporary password. Choose your own before you continue. Nothing else in the admin is available until you do.`}
    >
      <PasswordForm currentLabel="Temporary password" submitLabel="Set password and continue" />
      <p className="mt-5 text-xs leading-relaxed text-text-dim">
        Changing the password signs this account out everywhere else.{' '}
        <button type="button" onClick={logout} className="underline hover:text-accent focus:outline-none focus-visible:text-accent">Sign out instead</button>
      </p>
    </Shell>
  );
}
