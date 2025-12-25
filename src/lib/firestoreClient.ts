import { getFirestore } from 'firebase/firestore';
import { firebaseApp, firebaseReady } from './firebaseClient';

export const db = firebaseReady && firebaseApp ? getFirestore(firebaseApp) : undefined;

