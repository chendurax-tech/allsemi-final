import { createInterface } from 'node:readline/promises';
import { validateEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { User } from '../src/models/index.js';
import { hashPassword, generatePassword, passwordProblem } from '../src/utils/password.js';
import { normaliseEmail } from '../src/utils/sanitize.js';
import { ROLES } from '../src/config/constants.js';

/*
  Creates a user from the command line. This is how the FIRST
  production account is made (the development seed does not run in
  production):

    npm run create-admin -- --email you@your-domain --name "Your Name"
    npm run create-admin -- --email recruiter@your-domain --name "A Recruiter" --role RECRUITER

  The password is read from the ADMIN_PASSWORD environment variable if
  it is set; otherwise one is generated and printed once. The user is
  asked to change a generated password at first sign-in.
*/
function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : '';
}

async function main() {
  const { problems } = validateEnv();
  if (problems.length) throw new Error(`Fix the environment first:\n- ${problems.join('\n- ')}`);

  let email = normaliseEmail(option('email'));
  let name = option('name');
  const role = option('role') || 'SUPER_ADMIN';
  if (!ROLES.includes(role)) throw new Error(`--role must be one of ${ROLES.join(', ')}`);

  if (!email || !name) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (!email) email = normaliseEmail(await rl.question('Email: '));
    if (!name) name = (await rl.question('Name: ')).trim();
    rl.close();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid --email is required.');
  if (!name) throw new Error('--name is required.');

  const supplied = process.env.ADMIN_PASSWORD || '';
  if (supplied && passwordProblem(supplied)) throw new Error(`ADMIN_PASSWORD: ${passwordProblem(supplied)}`);
  const password = supplied || generatePassword();

  await connectDatabase();
  if (await User.findOne({ email })) throw new Error(`A user with the email ${email} already exists.`);
  await User.create({ name, email, role, passwordHash: await hashPassword(password), mustChangePassword: !supplied });

  console.log(`\nCreated ${role} ${email}.`);
  if (!supplied) console.log(`Temporary password (shown once): ${password}\nChange it after signing in.\n`);
}

main()
  .catch((error) => {
    console.error(`\nCould not create the user: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase().catch(() => {}));
