import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, onUnauthorized } from '../lib/api/index.js';

/*
  Admin authentication state.

  The session itself is an HttpOnly cookie that the backend sets at
  sign-in and the browser sends with every request. JavaScript cannot
  read it, and nothing about the session is written to localStorage or
  sessionStorage here. What this provider holds in memory is only what
  the backend says about the signed-in user:
    { id, name, email, role, permissions, mustChangePassword }

  status: 'checking'   asking the backend whether a session exists
          'signedOut'  no session: the sign-in screen is shown
          'signedIn'   user is set

  can(permission) decides what the screens show. It is a convenience
  only: the server checks the same permission on every request, so a
  hidden button is never the control.
*/

const AuthContext = createContext(null);

export const SESSION_ENDED = 'Your session ended. Sign in again.';

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  // Read by the 401 listener, which must not react to the first
  // "is anyone signed in" check or to a sign-out the user asked for.
  const signedIn = useRef(false);

  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then((current) => {
        if (cancelled) return;
        signedIn.current = true;
        setUser(current);
        setStatus('signedIn');
      })
      .catch(() => {
        // No session, or the server cannot be reached. Either way the
        // sign-in screen is the right place: its own request reports a
        // connection problem if there is one.
        if (!cancelled) setStatus('signedOut');
      });
    return () => { cancelled = true; };
  }, []);

  // Any request answered with 401 while signed in means the session
  // expired or was revoked (a password reset, a disabled account).
  useEffect(() => onUnauthorized(() => {
    if (!signedIn.current) return;
    signedIn.current = false;
    setUser(null);
    setMessage(SESSION_ENDED);
    setStatus('signedOut');
  }), []);

  const login = useCallback(async (email, password) => {
    const current = await authApi.login(email, password);
    signedIn.current = true;
    setMessage('');
    setUser(current);
    setStatus('signedIn');
    return current;
  }, []);

  const logout = useCallback(async () => {
    signedIn.current = false;
    try {
      await authApi.logout();
    } catch {
      // The session may already be gone. The screen returns to sign-in
      // either way, and the next request proves whether it is.
    }
    setUser(null);
    setMessage('');
    setStatus('signedOut');
  }, []);

  // After a password change the backend keeps this session and signs
  // out every other one. The user is read again so mustChangePassword
  // reflects what the server now holds.
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await authApi.changePassword(currentPassword, newPassword);
    setUser(await authApi.me());
  }, []);

  const value = useMemo(() => ({
    status,
    user,
    message,
    login,
    logout,
    changePassword,
    can: (permission) => Boolean(user && user.permissions.includes(permission)),
  }), [status, user, message, login, logout, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
