import 'dotenv/config';
import admin from 'firebase-admin';
import path from 'path';
import { createRequire } from 'module';

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

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@fluxyv3.online';
const ADMIN_PASS = process.env.SEED_ADMIN_PASS || '09876543211';
const ADMIN_USERNAME = 'Fluxinator';

async function seed() {
  const authSvc = admin.auth();
  const db = admin.firestore();

  let uid;
  try {
    const existing = await authSvc.getUserByEmail(ADMIN_EMAIL);
    uid = existing.uid;
    console.log(`Admin account already exists: ${ADMIN_EMAIL} (${uid})`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await authSvc.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASS,
        displayName: ADMIN_USERNAME,
      });
      uid = created.uid;
      console.log(`Created admin account: ${ADMIN_EMAIL} (${uid})`);
    } else {
      throw err;
    }
  }

  await db.collection('users').doc(uid).set(
    {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
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
  console.log('\n--- Admin Credentials ---');
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASS}`);
  console.log(`Username: ${ADMIN_USERNAME}`);
  console.log('Role:     admin');
  console.log('-------------------------\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
