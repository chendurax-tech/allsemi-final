import { useSectors } from '../../lib/usePublicData.js';

/*
  The choices the public forms offer, kept in one place instead of
  being retyped in each form. The fixed ones carry the values the
  backend accepts (backend/src/config/constants.js).
*/

// The "Engineering domain" choices: the names of the published sectors,
// in their order, read from the backend (useSectors). There are none
// until the sectors have loaded. `current` is the value the form holds:
// if it is not among the names (the list is still loading, or could not
// be loaded) it is kept as a choice, so a domain already chosen is
// neither dropped from the form nor shown as unselected.
export function useDomainOptions(current = '') {
  const { sectors } = useSectors();
  const names = [...new Set(sectors.map((sector) => sector.name).filter(Boolean))];
  return current && !names.includes(current) ? [...names, current] : names;
}

export const HIRING_TYPE_OPTIONS = ['Permanent Staffing', 'Project Staffing', 'RPO', 'Specialised Search'].map((value) => ({ value, label: value }));

export const WORK_MODE_OPTIONS = [
  { value: 'ON_SITE', label: 'On-site' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'REMOTE', label: 'Remote' },
];
