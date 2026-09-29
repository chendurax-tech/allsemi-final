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
*/

export const LOCATIONS = [
  {
    id: 'bengaluru',
    city: 'Bengaluru',
    country: 'India',
    region: 'APAC',
    label: 'ALLSEMIS Bengaluru',
    isHeadquarters: true,
    address: ['No.73, Nallurahalli, Whitefield', 'Bangalore South, Karnataka 560066'],
    phone: '+91-70901-23400',
    email: 'sales@allsemi.com',
    hours: ['Mon-Fri, 9:00 AM - 6:30 PM IST', 'Mon-Fri, 8:30 PM - 6:00 AM EST'],
    // [longitude, latitude]
    coordinates: [77.5946, 12.9716],
    // Admin-manageable visibility flag: an inactive location is kept in
    // the data (so re-activating it later needs no code change) but
    // filtered out of the rendered network - see OfficeNetwork.jsx's
    // `locations.filter((l) => l.active)`.
    active: true,
  },
];

// Locations a future admin panel has marked visible. Components should
// read through this rather than filtering LOCATIONS themselves, so the
// "what counts as active" rule lives in one place.
export function activeLocations() {
  return LOCATIONS.filter((location) => location.active !== false);
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
