const admin = require("firebase-admin");

const serviceAccount = require("./transcycle-58b76-firebase-adminsdk-fbsvc-e35e594121.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://transcycle-58b76.firebaseio.com"
});

const db = admin.firestore();

const drugs = [
  {
    drug_key: "E2_SUBLINGUAL",
    display_name: "Estradiol sublingual",
    category: "estrogen",
    route: "sublingual",
    half_life_hours: 3,
    peak_hours: 0.75,
    cmax_unit: "pg/mL",
    notes: "Vía preferida en TRH trans",
    is_active: true
  },
  {
    drug_key: "E2_VALERATE_IM",
    display_name: "Valerato de estradiol",
    category: "estrogen",
    route: "intramuscular",
    half_life_hours: 96,
    peak_hours: 48,
    cmax_unit: "pg/mL",
    notes: "Inyectable de larga duración",
    is_active: true
  },
  {
    drug_key: "E2_CYPIONATE_IM",
    display_name: "Cipionato de estradiol",
    category: "estrogen",
    route: "intramuscular",
    half_life_hours: 168,
    peak_hours: 72,
    cmax_unit: "pg/mL",
    notes: "Inyectable de duración intermedia",
    is_active: true
  },
  {
    drug_key: "E2_PATCH",
    display_name: "Parche transdérmico",
    category: "estrogen",
    route: "transdermal_patch",
    half_life_hours: 18,
    peak_hours: 10,
    cmax_unit: "pg/mL",
    notes: "Parche de 48-96h",
    is_active: true
  },
  {
    drug_key: "P4_RECTAL",
    display_name: "Progesterona micronizada",
    category: "progesterone",
    route: "rectal",
    half_life_hours: 20,
    peak_hours: 3.5,
    cmax_unit: "ng/mL",
    notes: "Vía rectal para mujeres trans",
    is_active: true
  },
  {
    drug_key: "SPIRO",
    display_name: "Espironolactona",
    category: "antiandrogen",
    route: "oral",
    half_life_hours: 1.4,
    peak_hours: 2.5,
    cmax_unit: "suppression_model",
    notes: "Bloqueador androgénico, no hormona exógena",
    is_active: true
  }
];

async function seedDatabase() {
  try {
    console.log("🔄 Iniciando seed de Firestore...");

    const batch = db.batch();

    for (const drug of drugs) {
      const docRef = db.collection("drug_profiles").doc(drug.drug_key);
      batch.set(docRef, drug);
    }

    await batch.commit();
    console.log("✅ ¡6 fármacos creados exitosamente!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

seedDatabase();
