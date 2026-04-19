# TransCycle & Health

App de seguimiento hormonal diseñada específicamente para mujeres trans en Terapia de Reemplazo Hormonal (TRH).

## Estructura del proyecto

```
transcycle/
├── db/
│   └── 001_initial_schema.sql     # Migración PostgreSQL (Bloque 1)
├── src/
│   ├── pharmacokinetics.ts        # Motor farmacocinético (Bloque 1)
│   ├── pharmacokinetics.test.ts   # 20 tests
│   ├── virtualCycle.ts            # Algoritmo de ciclo virtual (Bloque 2)
│   └── virtualCycle.test.ts       # 24 tests
├── backend/
│   ├── src/
│   │   ├── index.ts               # Servidor Express (Bloque 3)
│   │   ├── db/pool.ts             # Conexión PostgreSQL
│   │   ├── middleware/            # Auth JWT + validación Zod
│   │   ├── services/encryption.ts # AES-256-GCM
│   │   └── routes/                # 14 endpoints REST
│   └── tests/api.test.ts          # 21 tests
├── frontend/
│   └── dashboard.html             # Prototipo funcional (Bloque 4)
└── deploy/
    ├── scripts/setup.sh           # Setup automatizado
    └── docs/
        ├── openapi.yaml           # Documentación API
        └── BETA_CHECKLIST.md      # Checklist pre-lanzamiento
```

## Setup rápido

```bash
git clone <repo>
cd transcycle
bash deploy/scripts/setup.sh
```

Requiere: Node.js 18+, PostgreSQL 14+

## Fármacos soportados

| Fármaco | Vía | t½ | Pico |
|---|---|---|---|
| Estradiol | Sublingual | 3h | 45 min |
| Valerato de estradiol | IM | 96h | 48h |
| Cipionato de estradiol | IM | 168h | 72h |
| Estradiol parche | Transdérmico | 18h | 10h |
| Progesterona micronizada | Rectal | 20h | 3.5h |
| Espironolactona | Oral | 1.4h (canrenoato 16h) | 2.5h |

## Tests

```bash
# Bloque 1 — farmacocinética
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node src/pharmacokinetics.test.ts

# Bloque 2 — ciclo virtual
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node src/virtualCycle.test.ts

# Bloque 3 — backend
cd backend && npm test
```

Total: **65 tests pasando**.

## Seguridad

- Datos sensibles cifrados con **AES-256-GCM** antes de persistir
- Autenticación con **JWT** (RS256 en producción)
- Rate limiting por endpoint
- Modo discreto: cambia nombre e ícono de la app
- Sin telemetría ni publicidad

## Aviso clínico

Esta aplicación es una herramienta de seguimiento personal. Los niveles hormonales mostrados son estimaciones basadas en modelos farmacocinéticos y **no reemplazan exámenes de sangre**. Consulta siempre con tu médico o endocrinólogo/a antes de modificar tu régimen de TRH.

## Licencia

Proyecto de desarrollo activo — licencia por definir antes del lanzamiento público.
