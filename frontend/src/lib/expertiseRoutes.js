// A sector's address is /expertise/<slug>. The slug is part of the
// sector record (Admin, Expertise) and comes from the backend with the
// rest of the sector (useSectors in lib/usePublicData.js), so no list of
// sector slugs is kept here.

// Sector URLs that existed before the client-approved sector list.
// Each old slug redirects to the canonical page that now covers its
// subject, so an old link or bookmark never lands on a missing page or
// on a page whose heading no longer matches. Automotive engineering and
// aerospace / RF communications are both part of Mobility &
// Communications.
export const EXPERTISE_LEGACY_SLUGS = {
  'automotive-mobility': 'mobility-communications',
  'aerospace-communications': 'mobility-communications',
};
