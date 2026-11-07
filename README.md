# TOEFL iBT AI Prep Platform

Plataforma personal de preparación para el **TOEFL iBT** impulsada por IA. Genera
simulacros realistas, los califica automáticamente, estima tu score y actúa como tutor
personal con planes de estudio adaptativos.

> **Estado del proyecto — Fase 2 (formato TOEFL 2026 + Writing, Speaking y RAG)**
>
> Los 12 tipos de tarea del formato vigente desde el 21-ene-2026 están implementados con módulos adaptativos,
> orden oficial y relojes de servidor. Consulta [`docs/FORMAT_2026.md`](docs/FORMAT_2026.md) y [`docs/ROADMAP.md`](docs/ROADMAP.md).

## ¿Qué incluye?

- **Simulacros fieles al formato 2026**: Reading y Listening adaptativos (2 módulos), Writing (Build a Sentence, Email, Academic Discussion) y
  Speaking (Listen and Repeat, Interview).
- **Modo examen estricto**: relojes de servidor, sin acceso a respuestas, audio una sola vez, Listening sin volver atrás, grabación automática.
- **Evaluación con IA y RAG**: rúbricas + ejemplos calificados, varias muestras, correcciones verificadas, versión mejorada, citas.
- **Speaking**: transcripción, pausas/silencios, ritmo, muletillas, fluidez, cumplimiento del tiempo; revisión de grabaciones.
- **Estimador de puntaje** (0–120 y bandas 1–6) con confianza y explicación ([`docs/SCORING.md`](docs/SCORING.md)).
- **Contenido prácticamente ilimitado** con IA, control de calidad, antirrepetición y fuentes abiertas con atribución
  ([`docs/CONTENT_SOURCES.md`](docs/CONTENT_SOURCES.md)). Sin clave de API funciona con un banco original más pequeño.
- **Coach**: plan de estudio con ejercicios y recursos que se regenera tras cada intento; dashboard y analíticas.
- Docker Compose, pruebas unitarias/e2e y documentación completa.

## Stack

| Capa        | Tecnología |
|-------------|------------|
| Frontend    | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS (componentes propios, compatibles con shadcn/ui) |
| Backend     | NestJS 11, Node.js 22, TypeScript |
| ORM / DB    | Prisma + PostgreSQL 16 |
| Cache/colas | Redis 7 |
| Auth        | JWT (access/refresh), preparado para OAuth |
| IA          | OpenAI GPT + Whisper (STT) + TTS + embeddings (RAG); fallback offline |
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
- [Formato TOEFL 2026](docs/FORMAT_2026.md)
- [Fuentes de contenido](docs/CONTENT_SOURCES.md)
- [Cálculo de puntajes](docs/SCORING.md)
- [Guía funcional](docs/USER_GUIDE.md)
- [Pruebas](docs/TESTING.md)
- [Roadmap por fases](docs/ROADMAP.md)

## Aviso legal

La plataforma genera contenido **original** inspirado en la *estructura* y el *estilo*
del examen. No reproduce ni distribuye material oficial de ETS protegido por derechos de
autor. "TOEFL" y "TOEFL iBT" son marcas de ETS; este proyecto es una herramienta de
estudio independiente, sin afiliación con ETS.
