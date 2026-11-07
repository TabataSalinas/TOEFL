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

Cada dominio es un módulo Nest con su `Controller` + `Service`:

| Módulo | Responsabilidad |
|--------|-----------------|
| `auth`, `users` | JWT (access + refresh con rotación), perfil, metas, racha |
| `ai` | Fachada de IA: generación de ítems (OpenAI con **fallback** al banco offline), evaluación JSON, embeddings, STT, TTS |
| `content` | Código **puro** sin dependencias: taxonomía de temas, banco original, *C-test*, *Build a Sentence*, validación de calidad, utilidades de texto |
| `sources` | Fundamentación en fuentes abiertas (Wikipedia) con licencia y URL |
| `exams` | `ExamBuilderService`: genera cada módulo (tareas en paralelo), valida, rebalancea claves, evita repeticiones y persiste |
| `attempts` | **Modo examen**: temporizador de servidor, orden oficial, módulos adaptativos, bloqueo de respuestas, expiración automática |
| `scoring` | Calificación por tipo de tarea, puntaje adaptativo, total 0–120, banda 1–6, confianza y metodología |
| `writing` | Evaluación con rúbrica + RAG (varias muestras, mediana, anti-alucinación) y heurística de respaldo |
| `speaking` | Subida de audio, STT, métricas de habla, alineación *Listen and Repeat*, evaluación *Interview*, revisión de grabaciones |
| `rag` | Base de conocimiento (rúbricas, ejemplos calificados, guías), recuperación híbrida BM25 + embeddings (RRF) |
| `media`, `storage` | TTS con caché en disco; almacenamiento de grabaciones |
| `reports`, `dashboard`, `tutor` | Reportes por módulo, analítica, coach con plan automático |

### Integridad del examen
- El **reloj es del servidor** (`deadlineAt` por módulo); un cierre automático califica los módulos vencidos aunque el cliente desaparezca.
- `serve.ts` es la única puerta de salida de contenido durante el examen: sin claves, sin explicaciones, sin texto de Listening.
- Respuestas bloqueables (`locked`) y validación de que cada pregunta pertenece al módulo del intento.
- El reporte y las claves solo existen tras terminar el intento.

### Capa de IA
`AiService` usa OpenAI si hay clave; **cualquier fallo** cae al `BankProvider` (banco original + generadores por código).
Evaluación y STT/TTS devuelven `null` sin LLM y los llamadores activan heurísticas deterministas (con confianza baja).

### RAG para consistencia
Rúbrica de la tarea siempre inyectada → anclas recuperadas por similitud → N muestras con temperatura baja → mediana por dimensión → citas devueltas al usuario.
Detalle en [`SCORING.md`](SCORING.md).

## Frontend (Next.js)

- **App Router** con páginas cliente (`'use client'`) que consumen la API REST.
- `lib/api.ts`: cliente fetch con **refresh automático** de tokens.
- `lib/auth-context.tsx`: contexto de sesión; `AppShell` protege rutas.
- Tema claro/oscuro con `next-themes`; gráficas con `recharts`.
- Componente `ExamTimer`: cuenta regresiva basada en el `deadlineAt` del servidor,
  con alertas visuales y auto-finalización.

## Flujo de un simulacro

```
POST /exams/generate ──► Exam + módulo 1 de cada sección (tareas generadas en paralelo y validadas)
POST /attempts        ──► ExamAttempt + un SectionAttempt por módulo 1
POST .../sections/R/start    ──► deadline del módulo, contenido sin claves
POST .../answers · .../speaking/recordings ──► respuestas (bloqueables) / audio → STT → análisis
POST .../finish       ──► califica; R/L: enruta y construye el módulo 2 (fácil|difícil)
   └─ al cerrar todos ──► buildScoreReport (total, banda, confianza) + el coach regenera el plan
GET  /reports/attempts/:id ──► reporte completo (solo con el intento terminado)
```

## Fases

Ver [`ROADMAP.md`](ROADMAP.md) y [`FORMAT_2026.md`](FORMAT_2026.md).
