/*
  officeLocations - the single source of truth for ALLSEMIS's office/
  location network visualization (components/OfficeNetwork.jsx).

  Deliberately structured so this becomes admin-managed data later
  without touching the component: every field a future admin panel
  would edit (name, address, phone, email, hours, coordinates) lives
  here, not scattered through JSX. Adding a second office later is a
  matter of appending another entry to LOCATIONS - the component
  already renders however many entries this array holds.

  coordinates are real-world [longitude, latitude] degrees, used to
  project each office onto the abstract network map via
  projectCoordinates() below (simple equirectangular projection).
  Real coordinates are kept (rather than hand-placed pixel positions)
  so the visual stays geographically honest and any future office
  places itself correctly without manual layout work.

  Only one verified, real ALLSEMIS office exists today (Bengaluru) -
  the same address/phone/email already confirmed and in production use
  on the /contact page (see pages/Contact.jsx's OFFICE constant). No
  other office is invented here.

  Every location carries a `type`:
  - 'office'  : a confirmed ALLSEMIS office, with address and contact
                details. Bengaluru is the only one.
  - 'network' : a named engineering-network node. It sits on the map at
                its real coordinates and can be selected, but it is
                never presented as an office: no address, no phone, no
                email, no hours. The location panel shows only its
                city, country, "Engineering Network" and "Network
                node". Bhubaneswar and San Diego are network nodes
                until the client confirms otherwise.
  Changing a node into an office is a data change here (type, address,
  contact details), not a component change.

  `status` is the location's standing and `active` is the show/hide
  flag. `visual.labelSide` tells the desktop map which side of the node
  its label sits on, and `visual.labelRaise` (pixels, optional) lifts a
  label clear of a neighbouring one.
*/

export const LOCATION_TYPES = ['office', 'network'];
export const LOCATION_STATUSES = ['active', 'listed', 'planned', 'inactive'];

export const LOCATIONS = [
  {
    id: 'bengaluru',
    city: 'Bengaluru',
    country: 'India',
    region: 'APAC',
    label: 'ALLSEMIS Bengaluru',
    type: 'office',
    status: 'active',
    isHeadquarters: true,
    address: ['No.73, Nallurahalli, Whitefield', 'Bangalore South, Karnataka 560066'],
    phone: '+91-70901-23400',
    email: 'sales@allsemi.com',
    hours: ['Mon-Fri, 9:00 AM - 6:30 PM IST', 'Mon-Fri, 8:30 PM - 6:00 AM EST'],
    // [longitude, latitude]
    coordinates: [77.5946, 12.9716],
    description: 'Confirmed ALLSEMIS office and the active node of the engineering network.',
    visual: { labelSide: 'right' },
    // Admin-manageable visibility flag: an inactive location is kept in
    // the data (so re-activating it later needs no code change) but
    // filtered out of the rendered network - see OfficeNetwork.jsx's
    // `locations.filter((l) => l.active)`.
    active: true,
  },
  {
    id: 'bhubaneswar',
    city: 'Bhubaneswar',
    country: 'India',
    region: 'APAC',
    label: 'Bhubaneswar network node',
    type: 'network',
    status: 'active',
    isHeadquarters: false,
    address: [],
    phone: '',
    email: '',
    hours: [],
    coordinates: [85.8245, 20.2961],
    description: 'Engineering network node. Not an ALLSEMIS office.',
    visual: { labelSide: 'right', labelRaise: 22 },
    active: true,
  },
  {
    id: 'san-diego',
    city: 'San Diego',
    country: 'United States',
    region: 'Americas',
    label: 'San Diego network node',
    type: 'network',
    status: 'active',
    isHeadquarters: false,
    address: [],
    phone: '',
    email: '',
    hours: [],
    coordinates: [-117.1611, 32.7157],
    description: 'Engineering network node. Not an ALLSEMIS office.',
    visual: { labelSide: 'right' },
    active: true,
  },
];

// Locations a future admin panel has marked visible. Components should
// read through this rather than filtering LOCATIONS themselves, so the
// "what counts as active" rule lives in one place.
export function activeLocations() {
  return LOCATIONS.filter((location) => location.active !== false);
}

// Confirmed offices only - the selectable, addressable nodes.
export function officeLocations() {
  return activeLocations().filter((location) => location.type !== 'network');
}

// Named engineering-network nodes - shown on the map, never as offices.
export function networkLocations() {
  return activeLocations().filter((location) => location.type === 'network');
}

// Equirectangular projection: real-world [lon, lat] -> [x, y] inside a
// viewBox of the given width/height. Kept simple and dependency-free -
// good enough for a small set of office markers on a stylised network
// map, not a GIS tool.
export function projectCoordinates([lon, lat], width, height) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}
