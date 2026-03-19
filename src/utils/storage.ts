import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { SavedCase } from '../types';

function casesCol(uid: string) {
  return collection(db, 'users', uid, 'cases');
}

export async function loadCasesFromFirestore(
  uid: string,
): Promise<Record<string, SavedCase>> {
  const snapshot = await getDocs(casesCol(uid));
  const cases: Record<string, SavedCase> = {};
  snapshot.forEach((d) => {
    const { createdAt, updatedAt, ...data } = d.data();
    cases[d.id] = data as SavedCase;
  });
  return cases;
}

export async function saveCaseToFirestore(
  uid: string,
  docId: string | null,
  savedCase: SavedCase,
): Promise<string> {
  if (docId) {
    await setDoc(doc(db, 'users', uid, 'cases', docId), {
      ...savedCase,
      updatedAt: serverTimestamp(),
    });
    return docId;
  }
  const ref = await addDoc(casesCol(uid), {
    ...savedCase,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCaseFromFirestore(
  uid: string,
  docId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'cases', docId));
}
