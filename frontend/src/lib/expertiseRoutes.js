// Maps each SECTORS id (defined in components/Expertise.jsx) to its
// canonical /expertise/:slug route. Shared between App.jsx (route
// definitions), Header.jsx (dropdown navigation) and every internal
// link to a sector page, so they never drift apart.
export const EXPERTISE_SLUGS = {
  semiconductor: 'semiconductor-chip-engineering',
  embedded: 'embedded-systems-electronics',
  mobility: 'mobility-communications',
  'ai-infrastructure': 'ai-infrastructure-cloud',
  healthcare: 'healthcare-medical-technology',
  'consumer-retail': 'consumer-goods-retail',
  'business-finance': 'business-finance-consumer',
  'banking-fintech': 'banking-finance-fintech',
};

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
