/*
  Where a MongoDB connection string points, read without connecting:
  its hosts, its database name, and whether every host is this machine.
  The seed uses it to refuse a database that is not local unless the
  database is named on the command line. Credentials in the string are
  never returned.
*/
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function describeTarget(uri) {
  const match = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/.exec(String(uri || ''));
  if (!match) return { hosts: [], database: '', local: false };
  const hosts = match[2].split(',').map((host) => host.replace(/:\d+$/, '').toLowerCase());
  // An SRV name is a cluster address, never this machine.
  const local = !match[1] && hosts.every((host) => LOCAL_HOSTS.includes(host));
  let database = match[3] || '';
  try {
    database = decodeURIComponent(database);
  } catch {
    // keep the raw text
  }
  return { hosts, database, local };
}
