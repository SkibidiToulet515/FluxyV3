import 'dotenv/config';
import admin from 'firebase-admin';
import path from 'path';
import { createRequire } from 'module';
import { createInterface } from 'readline';

const require = createRequire(import.meta.url);

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('FIREBASE_PROJECT_ID not set in .env');
  process.exit(1);
}

const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (svcPath) {
  const resolved = path.resolve(import.meta.dirname, '..', svcPath);
  const serviceAccount = require(resolved);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getCredentials() {
  let email = process.env.SEED_ADMIN_EMAIL;
  let password = process.env.SEED_ADMIN_PASS;

  if (!email) {
    email = await prompt('Admin email: ');
  }
  if (!email) {
    console.error('Email is required. Set SEED_ADMIN_EMAIL in .env or enter it when prompted.');
    process.exit(1);
  }

  if (!password || password === 'CHANGE_ME_BEFORE_USE') {
    password = await prompt('Admin password (min 6 chars): ');
  }
  if (!password || password.length < 6) {
    console.error('Password is required and must be at least 6 characters.');
    console.error('Set SEED_ADMIN_PASS in .env or enter it when prompted.');
    process.exit(1);
  }

  return { email, password };
}

const ADMIN_USERNAME = 'Fluxinator';

async function seed() {
  const { email, password } = await getCredentials();

  const authSvc = admin.auth();
  const db = admin.firestore();

  let uid;
  try {
    const existing = await authSvc.getUserByEmail(email);
    uid = existing.uid;
    console.log(`Admin account already exists: ${email} (${uid})`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await authSvc.createUser({
        email,
        password,
        displayName: ADMIN_USERNAME,
      });
      uid = created.uid;
      console.log(`Created admin account: ${email} (${uid})`);
    } else {
      throw err;
    }
  }

  await db.collection('users').doc(uid).set(
    {
      username: ADMIN_USERNAME,
      usernameLower: ADMIN_USERNAME.toLowerCase(),
      email,
      role: 'admin',
      status: 'offline',
      avatar: null,
      bio: 'Fluxy Administrator',
      banned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`Firestore user doc set with role=admin for ${ADMIN_USERNAME}`);
  console.log('\n--- Admin Account ---');
  console.log(`Email:    ${email}`);
  console.log(`Username: ${ADMIN_USERNAME}`);
  console.log('Role:     admin');
  console.log('---------------------\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
