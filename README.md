# TOEFL iBT AI Prep Platform

Plataforma personal de preparación para el **TOEFL iBT** impulsada por IA. Genera
simulacros realistas, los califica automáticamente, estima tu score y actúa como tutor
personal con planes de estudio adaptativos.

> **Estado del proyecto — Fase 1 (base funcional)**
>
> Este repositorio se construye por fases. La **Fase 1** entrega la base completa del
> sistema y las secciones **Reading** y **Listening** de punta a punta. Las fases
> siguientes añaden Speaking, Writing, RAG, proctoring y el coach avanzado. Consulta
> [`docs/ROADMAP.md`](docs/ROADMAP.md).

## ¿Qué incluye la Fase 1?

- **Monorepo** con workspaces npm: `apps/api` (NestJS) y `apps/web` (Next.js).
- **Autenticación** con JWT (access + refresh), registro, login, perfil y metas.
- **Modelo de datos completo** (Prisma + PostgreSQL) para usuarios, exámenes, intentos,
  respuestas, grabaciones, ensayos, scores, planes de estudio, rachas y objetivos.
- **Generación de preguntas por IA** (OpenAI, con interfaz de proveedor intercambiable
  y un **banco de fallback** determinista para funcionar sin clave de API).
- **Reading y Listening** end-to-end: generación, modo examen con cronómetro,
  calificación automática, explicaciones y detección de temas difíciles.
- **Estimador de score TOEFL** (0–120 y bandas 1–6 del formato 2026) con nivel de
  confianza y explicación del cálculo.
- **Reportes y dashboard base**: resultados por intento, métricas por sección,
  evolución de score, precisión por tipo de pregunta, rachas y progreso hacia la meta.
- **Docker Compose** (PostgreSQL + Redis + API + Web) y documentación completa.

## Stack

| Capa        | Tecnología |
|-------------|------------|
| Frontend    | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend     | NestJS 11, Node.js 22, TypeScript |
| ORM / DB    | Prisma + PostgreSQL 16 |
| Cache/colas | Redis 7 |
| Auth        | JWT (access/refresh), preparado para OAuth |
| IA          | OpenAI GPT (proveedor intercambiable) + embeddings para RAG (fase 2) |
| Infra       | Docker / Docker Compose; compatible con Vercel (web) + contenedor (api) |

## Arranque rápido (Docker)

```bash
cp .env.example .env          # edita y coloca tu OPENAI_API_KEY (opcional en fase 1)
docker compose up -d --build  # levanta db, redis, api y web
# API:  http://localhost:4000/api/docs  (Swagger)
# Web:  http://localhost:3000
```

Sin Docker (desarrollo local): consulta [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Modelo de base de datos](docs/DATABASE.md)
- [API REST](docs/API.md)
- [Instalación](docs/INSTALLATION.md)
- [Despliegue](docs/DEPLOYMENT.md)
- [Roadmap por fases](docs/ROADMAP.md)

## Aviso legal

La plataforma genera contenido **original** inspirado en la *estructura* y el *estilo*
del examen. No reproduce ni distribuye material oficial de ETS protegido por derechos de
autor. "TOEFL" y "TOEFL iBT" son marcas de ETS; este proyecto es una herramienta de
estudio independiente, sin afiliación con ETS.
