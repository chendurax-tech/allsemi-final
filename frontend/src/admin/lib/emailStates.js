/*
  How the state of an email reads in the admin.

  The server reports one of these states for the shortlist, regret and
  selection emails (on the application) and for every entry of the
  email record:
    SENT            the email service accepted the message
    LOGGED          development mode: written to the server log only
    NOT_CONFIGURED  the email service is not connected
    FAILED          the email service refused it or could not be reached
    SENDING         an attempt is running
    NOT_SENT        nothing has been attempted
    CAPPED          an acknowledgement held back because the address had
                    already received several within the hour

  When an email FAILED the server also says why, as one word. The
  sentences below say what that means and, where it is the case, that
  trying again will not help until the server's email settings change.
  They hold no address, key or other detail of the account.
*/

const FAILURE_REASONS = {
  sender_not_verified: 'The email service refused the sender address: the domain in EMAIL_FROM on the server is not verified in Resend. No email can go out from that address until the domain is verified in Resend or the sender is changed. Sending again will fail the same way.',
  invalid_sender: 'The email service refused the sender address: EMAIL_FROM on the server is not a valid sender. Sending again will fail the same way until it is corrected.',
  credentials: 'The email service did not accept the API key on the server. Sending again will fail the same way until the key is corrected.',
  quota: 'The sending limit of the email service has been reached. Try again later.',
  rate_limited: 'The email service is receiving too many requests. Try again in a moment.',
  recipient: "The email service refused the recipient's address. Check the address on the record.",
  no_recipient: 'There is no email address on the record to send it to.',
  provider: 'The email service reported an error of its own. Try again in a moment.',
  timeout: 'The email service did not answer in time. Try again in a moment.',
  network: 'The email service could not be reached. Try again in a moment.',
};

// The sentence for a failure category, or '' when there is nothing
// more specific to say than "the email service did not accept it".
export const failureReason = (category) => FAILURE_REASONS[category] || '';

// The tone of a notice or badge for each state.
export const EMAIL_STATE_TONES = {
  SENT: 'teal', LOGGED: 'amber', NOT_CONFIGURED: 'amber', FAILED: 'red', SENDING: 'amber', NOT_SENT: 'dim', CAPPED: 'amber',
};

export const EMAIL_STATE_LABELS = {
  SENT: 'Sent', LOGGED: 'Not sent (development mode)', NOT_CONFIGURED: 'Not sent (email not connected)', FAILED: 'Not sent (failed)', SENDING: 'Sending', NOT_SENT: 'Not sent', CAPPED: 'Held back',
};

// The generic sentences the notifications use.
export const EMAIL_SEND_FAILED = 'Unable to send the email. Please try again.';
