import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/*
  ScrollToTop - scrolls to the top of the page on every normal route
  change. Deliberately skips this when the URL carries a hash (e.g.
  /#expertise): those are intentional in-page anchor targets, and
  forcing a top-scroll first would fight that behavior.
*/
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
