import { Navigate } from 'react-router-dom';

/*
  Contact - compatibility redirect only.

  The landing page's own #enquiry section is the single, canonical
  ALLSEMI enquiry experience. This route no longer renders a second
  copy of it; anything that used to link to /contact now points
  directly to /#enquiry, and this route exists purely so an old or
  external /contact link still lands somewhere useful instead of
  404ing.
*/
export default function Contact() {
  return <Navigate to="/#enquiry" replace />;
}
