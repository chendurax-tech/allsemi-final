import { SiteSettings } from '../models/index.js';

// The single site settings document. Created empty on first read, so
// the admin always has something to edit.
export async function getSiteSettings() {
  let settings = await SiteSettings.findOne({ key: 'site' });
  if (settings) return settings;
  try {
    settings = await SiteSettings.create({ key: 'site' });
  } catch (error) {
    // Two first reads at the same moment: the other one created it.
    if (error?.code !== 11000) throw error;
    settings = await SiteSettings.findOne({ key: 'site' });
  }
  return settings;
}

export async function updateContact(contact, user) {
  const settings = await getSiteSettings();
  settings.contact = {
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    hours: contact.hours,
  };
  settings.updatedByName = user?.name || '';
  await settings.save();
  return settings;
}
