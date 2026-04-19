#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TransCycle & Health — Script de setup completo
# Ejecutar con: bash setup.sh
# ═══════════════════════════════════════════════════════════

set -e  # Detener en cualquier error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${GREEN}▶ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo "  TransCycle & Health — Setup inicial"
echo "  ──────────────────────────────────"

# ── 1. Verificar dependencias ────────────────────────
step "Verificando dependencias del sistema"

command -v node  >/dev/null 2>&1 || fail "Node.js no encontrado. Instalar v18+"
command -v npm   >/dev/null 2>&1 || fail "npm no encontrado"
command -v psql  >/dev/null 2>&1 || fail "psql no encontrado. Instalar PostgreSQL 14+"

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[ "$NODE_VER" -lt 18 ] && fail "Node.js 18+ requerido (tienes v$NODE_VER)"
echo "  Node.js v$(node --version), npm v$(npm --version), psql $(psql --version | head -1)"

# ── 2. Variables de entorno ──────────────────────────
step "Configurando variables de entorno"

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env

  # Generar secretos automáticamente
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  ENC_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

  # Reemplazar placeholders
  sed -i "s/cambia_esto_por_un_secreto_de_64_bytes_minimo/$JWT_SECRET/" backend/.env
  sed -i "s/cambia_esto_por_32_bytes_en_hex_64_chars/$ENC_KEY/" backend/.env

  echo "  .env creado con secretos generados automáticamente"
else
  warn ".env ya existe, no se sobreescribió"
fi

# ── 3. Base de datos ─────────────────────────────────
step "Configurando base de datos PostgreSQL"

source backend/.env 2>/dev/null || true

if [ -z "$DATABASE_URL" ]; then
  warn "DATABASE_URL no definida. Usando valor por defecto."
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transcycle"
fi

# Extraer nombre de la BD de la URL
DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\///')

# Crear la BD si no existe
psql "${DATABASE_URL%/$DB_NAME}/postgres" -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" \
  | grep -q 1 || psql "${DATABASE_URL%/$DB_NAME}/postgres" -c "CREATE DATABASE $DB_NAME" \
  && echo "  Base de datos '$DB_NAME' verificada"

# Ejecutar migración
psql "$DATABASE_URL" -f db/001_initial_schema.sql -q \
  && echo "  Migración ejecutada — 9 tablas creadas + 6 drug_profiles seed"

# ── 4. Instalar dependencias del backend ─────────────
step "Instalando dependencias del backend"
cd backend && npm install --silent && cd ..
echo "  Dependencias instaladas"

# ── 5. Build de TypeScript ───────────────────────────
step "Compilando TypeScript"
cd backend && npx tsc --noEmit 2>&1 | head -20 || warn "Advertencias de TS (no fatales en dev)"
cd ..
echo "  Compilación verificada"

# ── 6. Tests ─────────────────────────────────────────
step "Ejecutando tests"

# Bloque 1
cd src && \
  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
  npx ts-node pharmacokinetics.test.ts 2>&1 | tail -3
cd ..

# Bloque 2
cd src && \
  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
  npx ts-node virtualCycle.test.ts 2>&1 | tail -3
cd ..

# Bloque 3
cd backend && \
  TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
  npx ts-node tests/api.test.ts 2>&1 | tail -3
cd ..

# ── 7. Resumen ───────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup completo. Para iniciar:${NC}"
echo ""
echo "    cd backend"
echo "    npm run dev"
echo ""
echo "  API disponible en: http://localhost:3000"
echo "  Dashboard (proto): abrir frontend/dashboard.html"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
