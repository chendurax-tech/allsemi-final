import React, { useEffect, useState } from 'react';
import ShortlistPanel from './ShortlistPanel.jsx';
import DecisionEmailPanel from './DecisionEmailPanel.jsx';
import EmailHistory from './EmailHistory.jsx';

/*
  ApplicationActions - what a recruiter can do with one application,
  wherever an application is shown:

    Shortlist                     the one workflow step (ShortlistPanel)
    Regret and selection emails   sent by their own buttons after the
                                  Rejected or Selected label was added
                                  (DecisionEmailPanel)
    Emails                        the server's record of what was sent
                                  about this application (EmailHistory)

  None of the three changes what the others do. The record of emails is
  read again after either of the first two has sent or tried one.
*/
export default function ApplicationActions({ item, onChanged }) {
  // The application as the server last returned it, so both panels
  // show the same record after either of them changed it.
  const [current, setCurrent] = useState(item);
  const [version, setVersion] = useState(0);
  useEffect(() => { setCurrent(item); }, [item]);

  const changed = (updated) => {
    setCurrent(updated);
    setVersion((value) => value + 1);
    if (onChanged) onChanged(updated);
  };
  return (
    <div className="space-y-4">
      <ShortlistPanel item={current} onChanged={changed} />
      <DecisionEmailPanel item={current} onChanged={changed} />
      <EmailHistory entityType="application" entityId={current.id} refreshKey={version} />
    </div>
  );
}

// The same record of emails for a requirement and an enquiry, in the
// shape the list drawer expects ({ item }).
export function RequirementEmails({ item }) {
  return <EmailHistory entityType="requirement" entityId={item.id} />;
}
export function EnquiryEmails({ item }) {
  return <EmailHistory entityType="enquiry" entityId={item.id} />;
}
