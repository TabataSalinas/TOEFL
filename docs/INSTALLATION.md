# Manual de instalación

## Requisitos

- **Node.js 20–22** (recomendado 22) y **npm 10+**
- **PostgreSQL 16** y **Redis 7** (o usa Docker para ambos)
- (Opcional) **Docker + Docker Compose**
- (Opcional) Una **clave de OpenAI** — sin ella, la app usa el generador mock
  determinista y funciona igualmente.

---

## Opción A — Docker Compose (recomendada)

Levanta PostgreSQL, Redis, API y Web con un comando.

```bash
git clone https://github.com/TabataSalinas/TOEFL.git
cd TOEFL
cp .env.example .env
# Edita .env: pon secretos JWT fuertes y (opcional) OPENAI_API_KEY
docker compose up -d --build
```

El contenedor de la API sincroniza el esquema al arrancar (`prisma migrate deploy` si existe `prisma/migrations`; si no, `prisma db push`).
Para crear el usuario demo:

```bash
docker compose exec api npx prisma db seed
```

Accede a:
- Web: http://localhost:3000
- API + Swagger: http://localhost:4000/api/docs
- Usuario demo: `demo@toefl.local` / `DemoPass123!`

---

## Opción B — Desarrollo local (sin Docker para las apps)

### 1. Base de datos y cache

Con Docker solo para la infraestructura:

```bash
docker compose up -d db redis
```

O usa instalaciones locales de PostgreSQL y Redis y ajusta `DATABASE_URL` /
`REDIS_URL` en `.env` (usa `localhost` en vez de `db`/`redis`).

### 2. Variables de entorno

```bash
cp .env.example .env
# Para dev local, usa localhost en las URLs:
# DATABASE_URL=postgresql://toefl:toefl_password_change_me@localhost:5432/toefl?schema=public
# REDIS_URL=redis://localhost:6379
```

### 3. Instalar dependencias (monorepo)

```bash
npm install
```

### 4. Prisma: generar cliente, migrar y sembrar

```bash
cd apps/api
npx prisma generate
npx prisma db push          # o: npx prisma migrate dev --name init  (genera migraciones versionables)
npx prisma db seed
cd ../..
```

### 5. Arrancar API y Web

En dos terminales:

```bash
npm run dev:api   # http://localhost:4000/api
npm run dev:web   # http://localhost:3000
```

---

## Verificación

```bash
curl http://localhost:4000/api/health
# { "status": "ok", "db": "up", "aiProvider": "mock" | "openai", ... }
```

Inicia sesión en la web con el usuario demo y empieza un simulacro de Reading.

## Pruebas

```bash
# Unitarias (no requieren DB)
npm run test --workspace @toefl/api

# E2E (requiere DATABASE_URL accesible)
npm run test:e2e --workspace @toefl/api
```

## Solución de problemas

- **`aiProvider: mock` pese a tener clave** — revisa `AI_PROVIDER=openai` y que
  `OPENAI_API_KEY` esté cargada en el proceso de la API.
- **Errores de conexión a DB** — confirma que `DATABASE_URL` apunta a `localhost`
  en dev local y a `db` dentro de Docker.
- **Redis no disponible** — la app sigue funcionando (el cache se degrada con
  elegancia); solo verás un warning.

## Voz, micrófono y audio

- **Micrófono**: el navegador pide permiso al usar la prueba de equipo. En `localhost` funciona sin HTTPS; en un servidor **necesitas HTTPS**.
- **Speech-to-text**: con `OPENAI_API_KEY` el servidor transcribe con Whisper (marcas de tiempo por palabra). Sin clave se usa el reconocimiento del
  navegador (Chrome/Edge); en Firefox no hay transcripción y Speaking tendrá poca información.
- **Audio de Listening/Speaking**: con clave se sintetiza en el servidor (TTS) y se cachea en `STORAGE_DIR/tts`; sin clave se usa la voz del navegador.
- **Fuentes abiertas** (opcional): `SOURCES_ENABLED=true` y `CONTACT_EMAIL=tu@correo` (Wikimedia lo exige en el User-Agent).
