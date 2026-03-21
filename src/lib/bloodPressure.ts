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
import type { BloodPressureRecord, BloodPressureFormData, BPCategory, Gender } from '@/types';

const COLLECTION_NAME = 'bloodPressureRecords';

function timestampToDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date();
  if ('toDate' in ts) return ts.toDate();
  return ts;
}

export async function addBPRecord(
  userId: string,
  data: BloodPressureFormData
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    userId,
    systolic: parseInt(data.systolic, 10),
    diastolic: parseInt(data.diastolic, 10),
    heartRate: parseInt(data.heartRate, 10),
    measuredAt: serverTimestamp(),
    arm: data.arm,
    position: data.position,
    notes: data.notes,
    imageUrl: data.imageUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateBPRecord(
  id: string,
  data: Partial<BloodPressureFormData>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.systolic !== undefined) updateData.systolic = parseInt(data.systolic, 10);
  if (data.diastolic !== undefined) updateData.diastolic = parseInt(data.diastolic, 10);
  if (data.heartRate !== undefined) updateData.heartRate = parseInt(data.heartRate, 10);
  if (data.arm !== undefined) updateData.arm = data.arm;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  await updateDoc(docRef, updateData);
}

export async function deleteBPRecord(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function getUserBPRecords(
  userId: string
): Promise<BloodPressureRecord[]> {
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
      systolic: data.systolic,
      diastolic: data.diastolic,
      heartRate: data.heartRate,
      measuredAt: timestampToDate(data.measuredAt),
      arm: data.arm || 'left',
      position: data.position || 'sitting',
      notes: data.notes || '',
      imageUrl: data.imageUrl || '',
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as BloodPressureRecord;
  });
  return records.sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime());
}

/**
 * Classify blood pressure reading based on AHA guidelines.
 */
export function classifyBP(systolic: number, diastolic: number): BPCategory {
  if (systolic > 180 || diastolic > 120) return 'crisis';
  if (systolic >= 140 || diastolic >= 90) return 'hypertension2';
  if (systolic >= 130 || diastolic >= 80) return 'hypertension1';
  if (systolic >= 120 && diastolic < 80) return 'elevated';
  return 'normal';
}

/**
 * Get color for BP category.
 */
export function getBPCategoryColor(category: BPCategory): string {
  switch (category) {
    case 'normal': return '#22c55e';
    case 'elevated': return '#eab308';
    case 'hypertension1': return '#f97316';
    case 'hypertension2': return '#ef4444';
    case 'crisis': return '#dc2626';
  }
}

/**
 * Get gender-specific BP normal description key.
 * Returns the appropriate i18n key based on gender.
 */
export function getBPNormalDescKey(gender: Gender): 'bpNormalDescMale' | 'bpNormalDescFemale' | 'bpNormalDesc' {
  switch (gender) {
    case 'male': return 'bpNormalDescMale';
    case 'female': return 'bpNormalDescFemale';
    default: return 'bpNormalDesc';
  }
}

/**
 * Analyze blood pressure records and return statistics.
 */
export function analyzeBPRecords(records: BloodPressureRecord[]) {
  if (records.length === 0) {
    return null;
  }

  const systolicValues = records.map((r) => r.systolic);
  const diastolicValues = records.map((r) => r.diastolic);
  const heartRateValues = records.map((r) => r.heartRate);

  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const min = (arr: number[]) => Math.min(...arr);
  const max = (arr: number[]) => Math.max(...arr);

  const avgSystolic = avg(systolicValues);
  const avgDiastolic = avg(diastolicValues);

  const categoryCount: Record<BPCategory, number> = {
    normal: 0,
    elevated: 0,
    hypertension1: 0,
    hypertension2: 0,
    crisis: 0,
  };

  for (const record of records) {
    const cat = classifyBP(record.systolic, record.diastolic);
    categoryCount[cat]++;
  }

  return {
    totalRecords: records.length,
    avgSystolic,
    avgDiastolic,
    avgHeartRate: avg(heartRateValues),
    minSystolic: min(systolicValues),
    maxSystolic: max(systolicValues),
    minDiastolic: min(diastolicValues),
    maxDiastolic: max(diastolicValues),
    minHeartRate: min(heartRateValues),
    maxHeartRate: max(heartRateValues),
    overallCategory: classifyBP(avgSystolic, avgDiastolic),
    categoryCount,
  };
}
