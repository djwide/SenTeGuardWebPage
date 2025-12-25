import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
    browserLocalPersistence,
    getAuth,
    GoogleAuthProvider,
    setPersistence,
    type Auth
} from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID
};

const missingKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

export const firebaseReady = missingKeys.length === 0;

export function getMissingFirebaseKeys(): string[] {
    return missingKeys;
}

let app: FirebaseApp | undefined;
if (firebaseReady) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const firebaseApp = app;
export const auth: Auth | undefined = app ? getAuth(app) : undefined;
export const googleProvider = firebaseReady ? new GoogleAuthProvider() : undefined;

if (auth && typeof window !== 'undefined') {
    auth.useDeviceLanguage();
    setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn('Unable to persist Firebase auth session', error);
    });
}

