import {
  collection,
  query,
  getDocs,
  addDoc,
  setDoc,
  doc,
  orderBy,
  limit,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./config";

// ───── DRUGS (catálogo global) ─────
export async function getDrugs() {
  const snapshot = await getDocs(collection(db, "drug_profiles"));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ───── SYMPTOMS ─────
export async function getSymptoms(uid, limitCount = 7) {
  const q = query(
    collection(db, "users", uid, "symptoms"),
    orderBy("logged_at", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function logSymptoms(uid, payload) {
  const symptomsRef = collection(db, "users", uid, "symptoms");
  const docRef = await addDoc(symptomsRef, {
    ...payload,
    logged_at: serverTimestamp()
  });
  return { id: docRef.id, ...payload };
}

// ───── DIARY ─────
export async function getDiaryEntries(uid) {
  const q = query(
    collection(db, "users", uid, "diary"),
    orderBy("entry_date", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDiaryEntry(uid, dateString) {
  const docRef = doc(db, "users", uid, "diary", dateString);
  const snapshot = await getDocs(query(
    collection(db, "users", uid, "diary"),
    where("entry_date", "==", dateString)
  ));
  return snapshot.docs.length > 0 ? snapshot.docs[0].data() : null;
}

export async function saveDiaryEntry(uid, dateString, payload) {
  const docRef = doc(db, "users", uid, "diary", dateString);
  await setDoc(docRef, {
    ...payload,
    entry_date: dateString,
    created_at: serverTimestamp()
  }, { merge: true });
  return { id: dateString, ...payload };
}

// ───── BLOOD TESTS ─────
export async function getBloodTests(uid) {
  const q = query(
    collection(db, "users", uid, "blood_tests"),
    orderBy("test_date", "desc"),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addBloodTest(uid, payload) {
  const testsRef = collection(db, "users", uid, "blood_tests");
  const docRef = await addDoc(testsRef, {
    ...payload,
    test_date: serverTimestamp()
  });
  return { id: docRef.id, ...payload };
}

// ───── MEDICATIONS ─────
export async function getMedications(uid) {
  const q = query(
    collection(db, "users", uid, "medications"),
    where("is_active", "==", true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addMedication(uid, payload) {
  const medsRef = collection(db, "users", uid, "medications");
  const docRef = await addDoc(medsRef, {
    ...payload,
    is_active: true,
    created_at: serverTimestamp()
  });
  return { id: docRef.id, ...payload };
}

export async function updateMedicationStock(uid, medId, newStock) {
  const docRef = doc(db, "users", uid, "medications", medId);
  await setDoc(docRef, { stock_units: newStock }, { merge: true });
  return { id: medId, stock_units: newStock };
}

export async function deactivateMedication(uid, medId) {
  const docRef = doc(db, "users", uid, "medications", medId);
  await setDoc(docRef, { is_active: false }, { merge: true });
}

// ───── ADMINISTRATION LOG ─────
export async function getAdministrationLog(uid, limitCount = 50) {
  const q = query(
    collection(db, "users", uid, "administration_log"),
    orderBy("administered_at", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function logAdministration(uid, payload) {
  const logRef = collection(db, "users", uid, "administration_log");
  const docRef = await addDoc(logRef, {
    ...payload,
    administered_at: serverTimestamp()
  });
  return { id: docRef.id, ...payload };
}

// ───── BODY MAP SITES ─────
export async function getBodyMapSites(uid) {
  const snapshot = await getDocs(collection(db, "users", uid, "body_map_sites"));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ───── CYCLE DATA ─────
export async function getCurrentCycle(uid) {
  // Obtener el documento de ciclo más reciente
  const q = query(
    collection(db, "users", uid, "virtual_cycle"),
    orderBy("cycle_number", "desc"),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.length > 0 ? snapshot.docs[0].data() : null;
}

export async function saveCycle(uid, cycleNumber, cycleData) {
  const docRef = doc(db, "users", uid, "virtual_cycle", String(cycleNumber));
  await setDoc(docRef, {
    ...cycleData,
    cycle_number: cycleNumber,
    updated_at: serverTimestamp()
  });
  return cycleData;
}
