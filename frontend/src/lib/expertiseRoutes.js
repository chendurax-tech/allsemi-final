// Maps each SECTORS id (defined in components/Expertise.jsx) to its
// future /expertise/:slug route, per ALLSEMI-CONTENT-MASTER.md's
// routing table. Shared between App.jsx (route definitions) and
// Header.jsx (dropdown navigation), so the two never drift apart.
export const EXPERTISE_SLUGS = {
  semiconductor: 'semiconductor-chip-engineering',
  'ai-infrastructure': 'ai-infrastructure-cloud',
  automotive: 'automotive-mobility',
  aerospace: 'aerospace-communications',
  'business-finance': 'business-finance-consumer',
  'banking-fintech': 'banking-finance-fintech',
  'consumer-retail': 'consumer-goods-retail',
  healthcare: 'healthcare-medical-technology',
};
