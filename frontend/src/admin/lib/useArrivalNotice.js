import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/*
  A screen that finishes by moving to another address (a new record
  saved, a record deleted) hands its confirmation to the next screen
  through the router: navigate(path, { state: { notice } }).

  This hook reads that message once and then clears it from the
  browser's history entry, so reloading or coming back to the page does
  not announce the same thing again.
*/
export function useArrivalNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const arrived = location.state?.notice || '';
  const [notice, setNotice] = useState(arrived);

  useEffect(() => {
    if (arrived) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [arrived, location.pathname, location.search, navigate]);

  return [notice, setNotice];
}
