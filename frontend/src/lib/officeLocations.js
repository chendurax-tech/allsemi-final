/*
  officeLocations - what the network map (components/OfficeNetwork.jsx)
  needs besides the location records themselves.

  There are no location records in this file. They are stored in the
  database, edited in the admin (Locations) and read by the public
  pages from the backend through useLocations() in
  lib/usePublicData.js (GET /api/public/locations), which returns only
  the locations switched on in the admin.

  A location as the map receives it:
    id, city, country, region, label
    type            'office' or 'network' (see below)
    status, isHeadquarters
    address[], phone, email, hours[]   an office only
    coordinates     real-world [longitude, latitude] in degrees
    description
    visual          { labelSide: 'left' | 'right', labelRaise?: pixels }
    active

  Every location carries a `type`:
  - 'office'  : a confirmed ALLSEMIS office, with address and contact
                details.
  - 'network' : a named engineering-network node. It sits on the map at
                its real coordinates and can be selected, but it is
                never presented as an office: no address, no phone, no
                email, no hours (the backend does not send them). The
                location panel shows only its city, country,
                "Engineering Network" and "Network node".
  Changing a node into an office is a change to the record in the
  admin (type, address, contact details), not a component change.

  coordinates are projected onto the map with projectCoordinates()
  below. Real coordinates are kept (rather than hand-placed pixel
  positions) so the visual stays geographically honest and a new
  location places itself without manual layout work.
  `visual.labelSide` tells the desktop map which side of a network node
  its label sits on, and `visual.labelRaise` (pixels, optional) lifts a
  label clear of a neighbouring one.
*/

export const LOCATION_TYPES = ['office', 'network'];
export const LOCATION_STATUSES = ['active', 'listed', 'planned', 'inactive'];

// Equirectangular projection: real-world [lon, lat] -> [x, y] inside a
// viewBox of the given width/height. Kept simple and dependency-free -
// good enough for a small set of location markers on a stylised network
// map, not a GIS tool.
export function projectCoordinates([lon, lat], width, height) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}
