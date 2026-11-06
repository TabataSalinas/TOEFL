# Arquitectura

## Visión general

Monolito modular con frontend y backend desacoplados, orquestados con Docker.
Pensado para **uso personal**: simple de operar, fácil de desplegar, sin
complejidad de microservicios.

```
┌──────────────────────────────────────────────────────────────┐
│                          Navegador                             │
│   Next.js (App Router) · React · Tailwind · shadcn/ui          │
└───────────────┬────────────────────────────────────────────────┘
                │ HTTPS / REST (Bearer JWT)
┌───────────────▼────────────────────────────────────────────────┐
│                      API — NestJS (REST)                        │
│  Auth · Users · Exams · Attempts · Scoring · Reports ·          │
│  Dashboard · Tutor · AI (provider abstraction)                  │
└───┬───────────────┬───────────────────────┬────────────────────┘
    │ Prisma        │ ioredis               │ OpenAI SDK / Mock
┌───▼────┐     ┌────▼────┐             ┌─────▼──────────────┐
│Postgres│     │  Redis  │             │  AI provider       │
│  16    │     │  (cache)│             │ (OpenAI | fallback)│
└────────┘     └─────────┘             └────────────────────┘
```

## Backend (NestJS)

Cada dominio es un módulo Nest independiente con su `Controller` + `Service`:

| Módulo      | Responsabilidad |
|-------------|-----------------|
| `auth`      | Registro, login, refresh con rotación, reset de contraseña. JWT global. |
| `users`     | Perfil, metas (semanal/mensual), preferencias, racha. |
| `ai`        | Abstracción de proveedor: `OpenAiProvider` + `MockAiProvider` con fallback automático. |
| `exams`     | Generación de simulacros (full o por sección) y persistencia del blueprint. |
| `attempts`  | **Modo examen**: temporizador autoritativo en servidor, entrega de preguntas sin respuestas, guardado, finalización y expiración de secciones. |
| `scoring`   | Calificación automática objetiva, score escalado 0–30, total 0–120, banda 1–6, confianza y explicación. |
| `reports`   | Reporte detallado por intento (revela respuestas tras completar), progreso y precisión por skill. |
| `dashboard` | Racha, metas, tiempo total, readiness, progreso a objetivo. |
| `tutor`     | Coach: análisis de debilidades, resumen, plan de estudio adaptativo con ganancia estimada de puntos. |
| `health`    | Healthcheck (DB + proveedor IA). |

### Principios de integridad del examen

- El **temporizador vive en el servidor**: cada `SectionAttempt` guarda
  `startedAt` y `deadlineAt`. El cliente solo muestra la cuenta regresiva.
- Las preguntas se sirven **sin** `correctAnswer` ni `explanation` mientras el
  examen está en curso (`AttemptsService.serveQuestions`).
- Las respuestas enviadas **después del `deadlineAt`** se rechazan y la sección
  se marca `EXPIRED`.
- Las respuestas correctas y explicaciones solo se exponen vía `ReportsService`
  cuando el intento está `COMPLETED`.

### Capa de IA (proveedor intercambiable)

`AiService` resuelve el proveedor en tiempo de ejecución:

1. `AI_PROVIDER=openai` + `OPENAI_API_KEY` presente → **OpenAI**, con *fallback*
   automático a mock ante cualquier error.
2. En cualquier otro caso → **MockAiProvider** determinista (genera contenido
   original offline). Esto garantiza que la plataforma funcione sin clave ni red.

El contrato `AiProvider` (`ai.types.ts`) permite añadir otros proveedores
(Anthropic, Azure OpenAI, local) sin tocar el resto del sistema.

## Frontend (Next.js)

- **App Router** con páginas cliente (`'use client'`) que consumen la API REST.
- `lib/api.ts`: cliente fetch con **refresh automático** de tokens.
- `lib/auth-context.tsx`: contexto de sesión; `AppShell` protege rutas.
- Tema claro/oscuro con `next-themes`; gráficas con `recharts`.
- Componente `ExamTimer`: cuenta regresiva basada en el `deadlineAt` del servidor,
  con alertas visuales y auto-finalización.

## Flujo de un simulacro

```
POST /exams/generate ──► crea Exam + Sections + Passages + Questions (IA)
POST /attempts        ──► crea ExamAttempt + SectionAttempts (NOT_STARTED)
POST /attempts/:id/sections/:section/start  ──► fija deadline, sirve preguntas
POST .../answers       ──► guarda respuestas (rechaza tras deadline)
POST .../finish        ──► califica (objetivo), registra sesión de estudio
   └─ al completar todas ──► ScoringService.buildScoreReport (total + confianza)
GET  /reports/attempts/:id ──► reporte con explicaciones y respuestas correctas
GET  /tutor/analysis, POST /tutor/plan ──► coaching + plan adaptativo
```

## Fases

Ver [`ROADMAP.md`](ROADMAP.md). El esquema de datos ya contempla Speaking,
Writing y RAG (`Recording`, `Essay`, `KnowledgeChunk`) para evolucionar sin
migraciones disruptivas.
