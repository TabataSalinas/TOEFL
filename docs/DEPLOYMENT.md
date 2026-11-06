# Manual de despliegue

La plataforma es un monolito modular pensado para uso personal. Dos caminos
soportados: **Docker Compose** (todo en una máquina) y **Vercel + contenedor**.

## Opción 1 — Docker Compose en una VM (recomendada)

Ideal para un VPS/Azure VM o tu propia máquina.

```bash
git clone https://github.com/TabataSalinas/TOEFL.git
cd TOEFL
cp .env.example .env
```

Edita `.env` con valores de producción:

```ini
NODE_ENV=production
POSTGRES_PASSWORD=<contraseña fuerte>
JWT_ACCESS_SECRET=<openssl rand -hex 48>
JWT_REFRESH_SECRET=<openssl rand -hex 48>
OPENAI_API_KEY=<tu clave>           # opcional
CORS_ORIGINS=https://tu-dominio      # dominio del frontend
NEXT_PUBLIC_API_URL=https://api.tu-dominio/api
```

Levanta todo:

```bash
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed   # opcional
```

Pon un **reverse proxy** (Caddy/Nginx/Traefik) delante para TLS:
- `https://tu-dominio` → `web:3000`
- `https://api.tu-dominio` → `api:4000`

### Backups

```bash
docker compose exec db pg_dump -U toefl toefl > backup_$(date +%F).sql
```

Las grabaciones/ensayos (fase 2) se guardan en el volumen `storage`.

---

## Opción 2 — Vercel (frontend) + contenedor (backend)

### Frontend en Vercel

1. Importa el repo en Vercel.
2. **Root Directory**: `apps/web`.
3. Variable de entorno: `NEXT_PUBLIC_API_URL=https://api.tu-dominio/api`.
4. Vercel detecta Next.js y despliega automáticamente.

### Backend (NestJS) en un contenedor

El frontend de Vercel es serverless y **no** puede hospedar un servidor NestJS
persistente con conexiones a DB/Redis. Despliega la API como contenedor en:
Azure Container Apps, Fly.io, Railway, Render o una VM con Docker.

```bash
docker build -f apps/api/Dockerfile -t toefl-api .
# Publica la imagen y ejecútala con las variables de entorno de producción.
```

Provisiona PostgreSQL y Redis gestionados (p. ej. Azure Database for PostgreSQL,
Azure Cache for Redis) y apunta `DATABASE_URL` / `REDIS_URL` a ellos.

Asegura `CORS_ORIGINS=https://<tu-dominio-vercel>` para que el navegador permita
las llamadas.

---

## Checklist de producción

- [ ] Secretos JWT largos y únicos (`openssl rand -hex 48`).
- [ ] Contraseña de PostgreSQL fuerte; DB no expuesta públicamente.
- [ ] TLS en el reverse proxy / plataforma.
- [ ] `CORS_ORIGINS` restringido a tu dominio.
- [ ] `prisma migrate deploy` ejecutado.
- [ ] Backups de DB programados.
- [ ] (Si usas OpenAI) límite de gasto configurado en tu cuenta.

## Variables de entorno (referencia)

Ver [`.env.example`](../.env.example) para la lista completa con descripciones.
