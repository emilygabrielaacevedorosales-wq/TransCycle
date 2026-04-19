c# TransCycle & Health — Contexto para Claude Code

## Qué es este proyecto

App móvil de seguimiento hormonal para mujeres trans en Terapia de Reemplazo Hormonal (TRH). Replica la experiencia de apps como Flo pero adaptada a TRH: sin ciclo menstrual biológico, el sistema crea un "ciclo virtual" basado en la farmacocinética de los fármacos.

**Propuesta de valor única:** El algoritmo calcula los picos y valles de estradiol/progesterona en sangre basándose en la dosis y vida media de cada fármaco, mapea esos datos en un calendario de 28 días con fases virtuales (folicular/lútea), y detecta el "período fantasma" (ventana de mayor sensibilidad sintomática).

---

## Estado actual del desarrollo

| Bloque | Contenido | Archivos | Tests |
|--------|-----------|----------|-------|
| 1 | Motor farmacocinético | `src/pharmacokinetics.ts` | 20 ✓ |
| 2 | Ciclo virtual + correlaciones | `src/virtualCycle.ts` | 24 ✓ |
| 3 | Backend Node.js + API REST | `backend/src/` | 21 ✓ |
| 4 | Dashboard HTML prototipo | `frontend/dashboard.html` | — |
| 5 | Deploy + OpenAPI + Checklist | `deploy/` | — |
| B | Algoritmo avanzado (regímenes combinados) | `src/pharmacokinetics_advanced.ts` | 16 ✓ |
| A | App Flutter (estructura base) | `flutter/lib/` | — |

**Total tests pasando: 81**

---

## Fármacos soportados y sus parámetros clave

| drug_key | Nombre | Vía | t½ | tmax | Cmax ref |
|----------|--------|-----|----|------|----------|
| `E2_SUBLINGUAL` | Estradiol sublingual | Sublingual | 3h | 45 min | 350 pg/mL por mg |
| `E2_VALERATE_IM` | Valerato de estradiol | IM | 96h | 48h | 80 pg/mL por mg |
| `E2_CYPIONATE_IM` | Cipionato de estradiol | IM | 168h | 72h | 90 pg/mL por mg |
| `E2_PATCH` | Parche transdérmico | Transdérmico | 18h | 10h | 100 pg/mL por parche |
| `P4_RECTAL` | Progesterona micronizada | Rectal | 20h | 3.5h | 0.08 ng/mL por mg |
| `SPIRO` | Espironolactona | Oral | 1.4h (canrenoato 16h) | 2.5h | modelo supresión T |

**Notas clínicas importantes:**
- `E2_SUBLINGUAL` es la vía preferida en TRH trans (evita primer paso hepático)
- `P4_RECTAL` se usa vía anal en mujeres trans (no oral, evita efecto sedante de alopregnanolona)
- `SPIRO` NO es una hormona exógena — es un bloqueador androgénico. Se modela como supresión de testosterona (0–1), no como nivel plasmático

---

## Arquitectura del sistema

```
transcycle/
├── src/                          # Módulos de algoritmo (TypeScript puro)
│   ├── pharmacokinetics.ts       # Motor farmacocinético base
│   ├── pharmacokinetics_advanced.ts  # Regímenes combinados, calibración, simulador
│   └── virtualCycle.ts           # Ciclo virtual 28 días, correlaciones, período fantasma
│
├── db/
│   └── 001_initial_schema.sql    # Migración PostgreSQL — 9 tablas + 6 drug_profiles seed
│
├── backend/                      # API REST Node.js + Express
│   ├── src/
│   │   ├── index.ts              # Servidor Express con helmet, cors, rate limiting
│   │   ├── db/pool.ts            # Pool PostgreSQL con withTransaction()
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT middleware + signToken()
│   │   │   └── validate.ts       # Zod validation middleware
│   │   ├── services/
│   │   │   └── encryption.ts     # AES-256-GCM: encrypt/decrypt/encryptJson
│   │   └── routes/
│   │       ├── auth.ts           # POST /auth/register|login, GET /auth/me, PATCH /auth/discrete-mode
│   │       ├── hrt.ts            # GET|POST /hrt/medications|log|body-map, GET /hrt/stock-alerts
│   │       ├── cycle.ts          # GET /cycle/current|plasma|dashboard-ring, POST /cycle/rebuild|symptoms
│   │       └── analyticsAndDiary.ts  # /analytics/blood-tests|trends, /diary CRUD
│   ├── src_algo/                 # Copia de los algoritmos para importar desde el backend
│   │   ├── pharmacokinetics.ts
│   │   └── virtualCycle.ts
│   └── tests/api.test.ts         # Tests de cifrado, JWT, schemas Zod (sin BD)
│
├── flutter/                      # App móvil Flutter
│   ├── pubspec.yaml              # Deps: dio, riverpod, local_auth, flutter_secure_storage, fl_chart
│   └── lib/
│       ├── main.dart             # Entry point, AppGate (auth), MainShell (bottom nav 5 tabs)
│       ├── theme/app_theme.dart  # TCColors + AppTheme (DM Serif Display + DM Sans)
│       ├── models/cycle_models.dart   # CycleStatus, RingDayData, DoseLog, SymptomEntry
│       ├── services/api_service.dart  # Todos los endpoints del backend
│       ├── widgets/cycle_ring.dart    # CustomPainter del anillo de 28 días con animación
│       └── screens/
│           ├── auth/login_screen.dart
│           ├── dashboard/dashboard_screen.dart
│           └── symptoms/symptoms_screen.dart
│
├── frontend/dashboard.html       # Prototipo HTML funcional (abrir directo en navegador)
└── deploy/
    ├── scripts/setup.sh          # Setup automatizado: BD + deps + tests
    └── docs/
        ├── openapi.yaml          # Documentación completa de los 14 endpoints
        └── BETA_CHECKLIST.md     # Checklist pre-lanzamiento beta
```

---

## API REST — endpoints disponibles (14 total)

Todos los endpoints protegidos requieren `Authorization: Bearer <JWT>`.

### Auth
- `POST /auth/register` — email, password, displayName, pronouns
- `POST /auth/login` — email, password → token
- `GET  /auth/me` — perfil de la usuaria
- `PATCH /auth/discrete-mode` — activar modo discreto (cambia nombre/ícono app)

### TRH
- `GET  /hrt/drugs` — catálogo de los 6 fármacos (sin auth)
- `GET|POST /hrt/medications` — régimen de la usuaria
- `GET|POST /hrt/log` — historial y registro de tomas. Al registrar: calcula curva plasmática automáticamente
- `GET  /hrt/body-map` — mapa de sitios corporales con estado descanso
- `GET  /hrt/body-map/next-site/:medId` — siguiente sitio recomendado para rotación
- `GET  /hrt/stock-alerts` — medicamentos con stock bajo

### Ciclo virtual
- `GET  /cycle/current` — día actual, fase, días hasta período fantasma
- `POST /cycle/rebuild` — recalcula el ciclo virtual con datos actuales → guarda en BD
- `GET|POST /cycle/symptoms` — historial y registro de síntomas (8 dimensiones)
- `GET  /cycle/plasma` — curva plasmática calculada (últimos N días)
- `GET  /cycle/dashboard-ring` — 28 puntos para el anillo + estado actual

### Analíticas y Diario
- `GET|POST /analytics/blood-tests` — exámenes de sangre (E2, T, Prolactina, LH, FSH, P4, SHBG)
- `GET  /analytics/trends` — tendencias hormonales vs. dosis por ciclo
- `GET|POST /diary` — diario de evolución cifrado (AES-256-GCM)
- `GET  /diary/:date` — entrada de fecha específica

---

## Base de datos — tablas principales

```sql
users                 -- usuarias con modo discreto, biometría, cifrado salt
drug_profiles         -- 6 fármacos con parámetros farmacocinéticos (seed incluido)
hrt_medications       -- régimen personal de cada usuaria
administration_log    -- cada toma/inyección registrada
plasma_levels         -- curva calculada (puntos cada 2h, 48h por dosis)
symptom_log           -- 8 métricas de síntomas + texto libre cifrado
blood_tests           -- resultados de laboratorio
virtual_cycle         -- ciclo aprendido (JSON del perfil + confidence score)
evolution_diary       -- diario cifrado con fotos
body_map_sites        -- rotación de sitios de inyección/parche
```

---

## Seguridad — decisiones de diseño

- **Cifrado AES-256-GCM** con IV aleatorio por operación. Layout del buffer: `[IV 12b][AuthTag 16b][CipherText]`. Integridad garantizada — alterar 1 byte lanza error.
- **JWT** en headers Authorization. El payload incluye `discreteMode: boolean`.
- **Rate limiting** diferenciado: auth 20 req/15min, global 100 req/15min.
- **Modo discreto**: cambia `document.title` y el logo de la app. En Flutter: `flutter_dynamic_icon` para cambiar el ícono real del launcher.
- **Biometría** (`local_auth`): bloquea al minimizar app. Si el dispositivo no tiene biometría, deja pasar.
- **Campos sensibles** en BD: `notes_encrypted`, `freetext_encrypted`, `body_changes_encrypted`, `photo_urls_encrypted` — todos BYTEA, nunca texto plano.

---

## Algoritmo de ciclo virtual — cómo funciona

```
1. Farmacocinética (Bloque 1 + B)
   dosis + t½ + Cmax → curva de niveles plasmáticos cada 2h

2. Normalización (Bloque 2)
   curva E2 + P4 → mapeo a 28 días → asignación de fases

3. Correlación sintomática
   síntomas registrados + posición en curva → Pearson r por síntoma

4. Período fantasma
   ventana deslizante de intensidad sintomática suavizada → pico + clasificación de trigger
   triggers: e2_trough | p4_peak | both | symptom_cluster

5. Refinamiento iterativo
   al final de cada ciclo de 28 días → refineCycle() con EWM α=0.3
   confidence score sube de 0.1 a 1.0 con más datos
```

**Fases del ciclo virtual:**
- Días 1–7: `follicular_early` (color teal `#8BBFB8`)
- Días 8–13: `follicular_late` (color lavanda `#B8AED4`)
- Día 14: `ovulation_virtual` (color rosa `#E8A4B0`)
- Días 15–20: `luteal_early` (color ámbar claro `#D4B87A`)
- Días 21–26: `luteal_late` (color ámbar `#D4A96A`)
- Días 27–28: `trough` (color rojo suave `#E88C8C`)

---

## Módulo B — algoritmo avanzado (nuevo en este bloque)

Archivo: `src/pharmacokinetics_advanced.ts`

Extiende el motor base con:

1. **`combinedE2Level()`** — suma E2 de múltiples fuentes simultáneas (ej: sublingual + parche). Aplica factores de corrección personal por fármaco.

2. **`detectMissedDoses()`** — detecta gaps > 1.5× el intervalo esperado. No extrapola la curva en esas ventanas.

3. **`calculatePersonalCalibration()`** — cuando la usuaria sube un examen real: `correctionFactor = medido / estimado`. Se suaviza con EWM α=0.4 para evitar saltos bruscos.

4. **`estimatedTestosteroneLevel()`** — estima la T restante usando el canrenoato de espiro (t½ 16h) como driver.

5. **`simulateRegimen()` / `compareRegimens()`** — proyecta 28 días de cualquier régimen hipotético. Base del endpoint futuro `/cycle/simulate`.

---

## App Flutter — estado actual

**Completado:**
- `main.dart` — AppGate (login/biometría), MainShell (bottom nav 5 tabs), bloqueo al volver de background
- `app_theme.dart` — paleta completa TransCycle, tipografía DM Serif Display + DM Sans
- `cycle_models.dart` — modelos tipados para todos los endpoints
- `api_service.dart` — wrapper Dio con interceptor JWT + secure storage
- `cycle_ring.dart` — CustomPainter del anillo de 28 días con animación `elasticOut`
- `dashboard_screen.dart` — carga paralela con `Future.wait`, ghost banner, stats row, confidence bar
- `symptoms_screen.dart` — 8 sliders con haptic feedback, historial visual con barras
- `login_screen.dart` — login + registro en una sola pantalla

**Pendiente (Módulo A restante):**
- `screens/hrt/` — pantalla de medicamentos + log de dosis + selector de sitio corporal
- `screens/analytics/` — gráficos de E2/T/P4 con fl_chart
- `screens/diary/` — diario cifrado
- `services/auth_service.dart` — separar lógica de auth del api_service
- Notificaciones push con `flutter_local_notifications`
- Build APK + TestFlight

---

## Módulos C y D — pendientes

**Módulo C (Comunidad y educación):**
- Tabla `resources` en PostgreSQL + seed de 20 artículos TRH
- Glosario de 30+ términos hormonales
- Generador de preguntas para endocrinólogo/a basado en el perfil
- Endpoints `GET /resources` y `GET /glossary`
- Pantalla Flutter "Aprender"

**Módulo D (Lanzamiento):**
- Política de privacidad GDPR-compatible en español
- Pipeline CI/CD con GitHub Actions → Railway (backend) + Supabase (BD)
- Sentry para monitoreo de errores
- Play Store acceso anticipado + TestFlight iOS
- Dashboard de métricas beta (interno)

---

## Cómo correr el proyecto

```bash
# 1. Setup inicial (requiere Node 18+ y PostgreSQL 14+)
bash deploy/scripts/setup.sh

# 2. Backend en desarrollo
cd backend
cp .env.example .env   # editar DATABASE_URL y secretos
npm install
npm run dev            # http://localhost:3000

# 3. Prototipo HTML (sin instalación)
open frontend/dashboard.html

# 4. App Flutter
cd flutter
flutter pub get
flutter run

# 5. Tests
# Bloque 1
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node src/pharmacokinetics.test.ts

# Bloque 2
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node src/virtualCycle.test.ts

# Módulo B (algoritmo avanzado)
cd src && TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node pharmacokinetics_advanced.test.ts

# Backend (sin BD)
cd backend && TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node tests/api.test.ts
```

---

## Prompt sugerido para iniciar en Claude Code

Pega esto al abrir el proyecto en Claude Code (VS Code):

```
Eres el arquitecto de TransCycle & Health. Lee el archivo CLAUDE.md en la raíz del proyecto para entender el contexto completo antes de hacer cualquier cambio.

Resumen rápido:
- App móvil de seguimiento hormonal para mujeres trans en TRH
- Stack: TypeScript (algoritmos), Node.js/Express (backend), PostgreSQL (BD), Flutter (móvil)
- 81 tests pasando distribuidos en 4 módulos
- Los algoritmos farmacocinéticos están en src/pharmacokinetics.ts y src/pharmacokinetics_advanced.ts
- El backend expone 14 endpoints REST en backend/src/routes/
- La app Flutter está en flutter/lib/ con estructura por capas (theme/models/services/screens/widgets)

Los módulos C y D están pendientes. Módulo C = educación/recursos. Módulo D = lanzamiento/CI-CD.

Antes de escribir código: lee los archivos relevantes para entender las convenciones existentes.
```

---

## Decisiones técnicas importantes (no cambiar sin revisar)

1. **`P4_RECTAL` vía rectal** — no oral, no vaginal. Específico para mujeres trans (evita alopregnanolona).
2. **`SPIRO` es modelo de supresión** (`isSuppressionModel: true`), no nivel plasmático. Retorna 0–1.
3. **Cifrado antes de la BD** — los campos `_encrypted` se cifran en `services/encryption.ts` ANTES de llegar al pool. La BD nunca ve texto plano de campos sensibles.
4. **`src_algo/`** en el backend es una copia de `src/` del root. Si cambias el algoritmo, actualizar ambas ubicaciones.
5. **`correctionFactor`** en calibración personal usa EWM α=0.4 — no reemplazar con el valor nuevo directamente.
6. **Fases del ciclo** son strings literales: `follicular_early`, `follicular_late`, `ovulation_virtual`, `luteal_early`, `luteal_late`, `trough`. Usados como ENUMs en PostgreSQL y como keys en Flutter.
