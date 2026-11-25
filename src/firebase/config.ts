import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const PRIMARY_FIRESTORE_DB_ID =
  firebaseConfig.firestoreDatabaseId || 'ai-studio-dd5emondeindiffr-652e18c5-b2c2-4867-be09-72a33506af58';
export const BACKUP_FIRESTORE_DB_ID = 'dd5e-secours-652e18c5';

const app = initializeApp(firebaseConfig);

export const dbPrimary = getFirestore(app, PRIMARY_FIRESTORE_DB_ID);
export const dbBackup = getFirestore(app, BACKUP_FIRESTORE_DB_ID);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function testConnection() {
  for (const database of [dbPrimary, dbBackup]) {
    try {
      await getDocFromServer(doc(database, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Vérifier la configuration Firebase : client hors ligne.');
      }
    }
  }
}

testConnection();
