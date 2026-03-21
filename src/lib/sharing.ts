import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ShareRecord, User } from '@/types';

const COLLECTION_NAME = 'shares';

function timestampToDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date();
  if ('toDate' in ts) return ts.toDate();
  return ts;
}

/**
 * Add a share: owner shares their records with another user.
 * Prevents duplicate shares.
 */
export async function addShare(
  owner: User,
  sharedWith: User
): Promise<string> {
  // Check if share already exists
  const existing = await getExistingShare(owner.uid, sharedWith.uid);
  if (existing) {
    return existing.id;
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ownerUserId: owner.uid,
    ownerDisplayName: owner.displayName ?? '',
    ownerEmail: owner.email ?? '',
    sharedWithUserId: sharedWith.uid,
    sharedWithDisplayName: sharedWith.displayName ?? '',
    sharedWithEmail: sharedWith.email ?? '',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Check if a share already exists between two users.
 */
async function getExistingShare(
  ownerUserId: string,
  sharedWithUserId: string
): Promise<ShareRecord | null> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('ownerUserId', '==', ownerUserId),
    where('sharedWithUserId', '==', sharedWithUserId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ownerUserId: data.ownerUserId,
    ownerDisplayName: data.ownerDisplayName,
    ownerEmail: data.ownerEmail,
    sharedWithUserId: data.sharedWithUserId,
    sharedWithDisplayName: data.sharedWithDisplayName,
    sharedWithEmail: data.sharedWithEmail,
    createdAt: timestampToDate(data.createdAt),
  };
}

/**
 * Remove a share by its document ID.
 */
export async function removeShare(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

/**
 * Get all users that the current user is sharing their records WITH.
 * (i.e., who can see my records)
 */
export async function getMySharedUsers(
  userId: string
): Promise<ShareRecord[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('ownerUserId', '==', userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ownerUserId: data.ownerUserId,
      ownerDisplayName: data.ownerDisplayName,
      ownerEmail: data.ownerEmail,
      sharedWithUserId: data.sharedWithUserId,
      sharedWithDisplayName: data.sharedWithDisplayName,
      sharedWithEmail: data.sharedWithEmail,
      createdAt: timestampToDate(data.createdAt),
    };
  });
}

/**
 * Get all users who have shared their records with me.
 * (i.e., whose records can I see)
 */
export async function getSharedWithMe(
  userId: string
): Promise<ShareRecord[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('sharedWithUserId', '==', userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ownerUserId: data.ownerUserId,
      ownerDisplayName: data.ownerDisplayName,
      ownerEmail: data.ownerEmail,
      sharedWithUserId: data.sharedWithUserId,
      sharedWithDisplayName: data.sharedWithDisplayName,
      sharedWithEmail: data.sharedWithEmail,
      createdAt: timestampToDate(data.createdAt),
    };
  });
}

/**
 * Encode user info into a QR code data string.
 */
export function encodeQRData(user: User): string {
  return JSON.stringify({
    type: 'kk-helper-share',
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
  });
}

/**
 * Decode QR code data string back into user info.
 * Returns null if the data is not a valid kk-helper QR code.
 */
export function decodeQRData(data: string): User | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type !== 'kk-helper-share' || !parsed.uid) {
      return null;
    }
    return {
      uid: parsed.uid,
      displayName: parsed.displayName || null,
      email: parsed.email || null,
      photoURL: null,
    };
  } catch {
    return null;
  }
}
