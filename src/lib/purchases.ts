import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PurchaseRecord, PurchaseFormData } from '@/types';

const COLLECTION_NAME = 'purchases';

function timestampToDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date();
  if ('toDate' in ts) return ts.toDate();
  return ts;
}

export async function addPurchase(
  userId: string,
  data: PurchaseFormData
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    userId,
    itemName: data.itemName,
    price: parseFloat(data.price),
    category: data.category,
    location: data.location,
    notes: data.notes,
    imageUrl: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePurchase(
  id: string,
  data: Partial<PurchaseFormData>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.itemName !== undefined) updateData.itemName = data.itemName;
  if (data.price !== undefined) updateData.price = parseFloat(data.price);
  if (data.category !== undefined) updateData.category = data.category;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.notes !== undefined) updateData.notes = data.notes;
  await updateDoc(docRef, updateData);
}

export async function deletePurchase(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function getUserPurchases(
  userId: string
): Promise<PurchaseRecord[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );

  const querySnapshot = await getDocs(q);
  const records = querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: data.userId,
      itemName: data.itemName,
      price: data.price,
      category: data.category,
      location: data.location,
      notes: data.notes || '',
      imageUrl: data.imageUrl || '',
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as PurchaseRecord;
  });
  return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function searchUserPurchases(
  userId: string,
  searchTerm: string
): Promise<PurchaseRecord[]> {
  const purchases = await getUserPurchases(userId);
  const lowerSearch = searchTerm.toLowerCase();
  return purchases.filter(
    (p) =>
      p.itemName.toLowerCase().includes(lowerSearch) ||
      p.category.toLowerCase().includes(lowerSearch) ||
      p.location.toLowerCase().includes(lowerSearch)
  );
}
