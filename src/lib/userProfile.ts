import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile, Gender } from '@/types';

const COLLECTION_NAME = 'userProfiles';

function timestampToDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date();
  if ('toDate' in ts) return ts.toDate();
  return ts;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const docRef = doc(db, COLLECTION_NAME, userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    userId: docSnap.id,
    gender: data.gender || 'unspecified',
    updatedAt: timestampToDate(data.updatedAt),
  };
}

export async function saveUserProfile(
  userId: string,
  data: { gender: Gender }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, userId);
  await setDoc(docRef, {
    gender: data.gender,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
