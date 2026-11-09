# Reproducir el proyecto desde cero

Guía para levantar la plataforma en una máquina nueva (Windows, macOS o Linux).

## 0. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Git | cualquiera reciente | clonar |
| Docker Desktop (o Docker Engine + Compose v2) | ≥ 24 | opción A (recomendada) |
| Node.js + npm | Node 20–22, npm ≥ 10 | opción B y pruebas |
| Chrome o Edge | actual | micrófono, voz y reconocimiento de voz del navegador |
| Clave de OpenAI | opcional | contenido ilimitado, evaluación con IA, Whisper y voces |

En Windows, clona dentro de WSL2 o deja que `.gitattributes` mantenga los finales de línea LF de los scripts.

## 1. Clonar y configurar

```bash
git clone https://github.com/TabataSalinas/TOEFL.git
cd TOEFL
cp .env.example .env
```

Edita `.env`:

| Variable | Valor |
|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | dos cadenas largas distintas (`openssl rand -hex 48`) |
| `POSTGRES_PASSWORD` | si la cambias, cambia también `DATABASE_URL` |
| `OPENAI_API_KEY` | opcional |
| `SOURCES_ENABLED`, `CONTACT_EMAIL` | opcional: fundamentar pasajes en Wikipedia |

## 2A. Levantar con Docker (recomendado)

```bash
docker compose up -d --build
docker compose logs -f api            # espera: "API listening on http://localhost:4000/api"
docker compose exec api npx prisma db seed
```

Al arrancar, el contenedor de la API crea o actualiza las tablas solo (`db push`, o `migrate deploy` si existen migraciones).

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:3000 |
| API + Swagger | http://localhost:4000/api/docs |
| Health | http://localhost:4000/api/health |

Usuario demo: `demo@toefl.local` / `DemoPass123!`

## 2B. Levantar sin Docker para las apps (desarrollo)

```bash
docker compose up -d db redis                     # o PostgreSQL 16 y Redis 7 instalados localmente
npm ci                                            # usa package-lock.json
cp .env apps/api/.env
```

En `apps/api/.env` usa `localhost` en lugar de `db` y `redis`:

```ini
DATABASE_URL=postgresql://toefl:toefl_password_change_me@localhost:5432/toefl?schema=public
REDIS_URL=redis://localhost:6379
```

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > apps/web/.env.local
cd apps/api && npx prisma generate && npx prisma db push && npx prisma db seed && cd ../..
npm run dev:api        # terminal 1 → http://localhost:4000/api
npm run dev:web        # terminal 2 → http://localhost:3000
```

## 3. Comprobar que funciona

```bash
curl http://localhost:4000/api/health
# {"status":"ok","db":"up","aiProvider":"bank"|"openai",...}
```

Prueba rápida en el navegador: inicia sesión → **Practice** → *Reading* → responde → al terminar el módulo 1 debe empezar el módulo 2 → **View results**.

## 4. Pruebas

```bash
cd apps/api && npx prisma generate && cd ../..
npm run test --workspace @toefl/api              # unitarias (sin BD)
npm run test:e2e --workspace @toefl/api          # integración (requiere la BD de 2B)
```

## 5. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `relation "User" does not exist` | No se aplicó el esquema: `docker compose exec api npx prisma db push` |
| La web no conecta con la API / error CORS | `NEXT_PUBLIC_API_URL` y `CORS_ORIGINS` deben coincidir con las URLs reales; en Docker, `NEXT_PUBLIC_API_URL` se fija **al construir** (`docker compose build web`) |
| `aiProvider: "bank"` pese a tener clave | Revisa `AI_PROVIDER=openai` y que `OPENAI_API_KEY` llegue al contenedor (`docker compose up -d --force-recreate api`) |
| El micrófono no funciona en un servidor | El navegador exige **HTTPS** fuera de `localhost` |
| No hay voz en Listening sin clave | Usa Chrome o Edge (síntesis de voz del navegador) |
| `docker-entrypoint.sh: not found` o `\r` en los logs | El script tiene CRLF: `git add --renormalize . && git commit` y reconstruye |

## 6. Reiniciar de cero

```bash
docker compose down -v      # borra BD, grabaciones y audio cacheado
docker compose up -d --build
docker compose exec api npx prisma db seed
```

Despliegue en un servidor o en Vercel: [`DEPLOYMENT.md`](DEPLOYMENT.md). Uso de la aplicación: [`USER_GUIDE.md`](USER_GUIDE.md).
