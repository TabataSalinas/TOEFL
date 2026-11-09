# Modelo de base de datos

ORM: **Prisma** sobre **PostgreSQL 16**. Esquema completo en
[`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).

El modelo cubre todas las fases; la Fase 1 usa activamente las entidades de
Reading/Listening, scoring y reporting. Speaking/Writing/RAG están modeladas y
se poblarán en fases posteriores.

## Entidades principales

### Usuarios y auth
- **User** — cuenta (email, hash de contraseña, OAuth opcional).
- **UserProfile** — 1:1 con User. Objetivo (0–120), fecha de examen, minutos/día,
  tema, idioma nativo, **racha** (`currentStreakDays`, `longestStreakDays`,
  `lastStudyDate`).
- **RefreshToken** — tokens de refresco hasheados, con rotación y revocación.
- **PasswordReset** — tokens de recuperación con expiración.

### Contenido de examen
- **Exam** — blueprint generado (full o por sección), dificultad, `generatedBy`
  (openai/mock/seed), `contentHash` para evitar duplicados.
- **ExamSection** — sección del examen (orden, `timeLimitSec`, instrucciones).
- **Passage** — pasaje de Reading o transcripción de Listening (`body`,
  `audioUrl`, `topic`, `wordCount`).
- **Question** — pregunta. Objetivas guardan `options` y `correctAnswer` (JSON) y
  `explanation`; productivas (Speaking/Writing) solo `prompt`. `skillTag` para
  análisis de debilidades.

### Intentos y respuestas
- **ExamAttempt** — intento de un usuario sobre un Exam (`status`,
  `startedAt`, `completedAt`).
- **SectionAttempt** — estado por sección con temporizador autoritativo
  (`startedAt`, `deadlineAt`, `timeSpentSec`, `status`).
- **Answer** — respuesta a una pregunta (`response` JSON, `isCorrect`,
  `pointsEarned`, `timeSpentSec`). Único por (sectionAttempt, question).

### Artefactos productivos (fase 2)
- **Recording** — grabación de Speaking (`fileUrl`, `transcript`, `metrics`).
- **Essay** — ensayo de Writing (`content`, `feedback`).

### Scores y reportes
- **ScoreReport** — 1:1 con ExamAttempt. `totalScore` (0–120), `totalBand`
  (1–6), `confidence` (0–1), `methodology` (texto explicativo).
- **SectionScore** — por sección: `rawCorrect/rawTotal`, `scaledScore` (0–30),
  `band`, `confidence`, `skillBreakdown` (JSON por skill).

### Plan de estudio, metas, sesiones
- **StudyPlan** / **StudyPlanItem** — plan adaptativo con `estPointsGain` y
  `status` por ítem.
- **Goal** — meta semanal/mensual (`targetMinutes`, `periodStart`).
- **StudySession** — registro de tiempo estudiado (alimenta racha y metas).

### RAG (fase 2)
- **KnowledgeChunk** — rúbricas / ejemplos de referencia + `embedding` (JSON;
  migrable a `pgvector`).

## Relaciones (resumen)

```
User 1─1 UserProfile
User 1─* RefreshToken, PasswordReset, ExamAttempt, StudyPlan, Goal, StudySession
Exam 1─* ExamSection 1─* Passage, Question
ExamAttempt 1─* SectionAttempt 1─* Answer, Recording, Essay
ExamAttempt 1─1 ScoreReport 1─* SectionScore
SectionAttempt 1─1 SectionScore
StudyPlan 1─* StudyPlanItem
```

## Migraciones

En la primera instalación genera la migración inicial:

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed   # usuario demo + examen de ejemplo
```

En producción/Docker se aplica con `prisma migrate deploy` (incluido en el
`CMD` del contenedor API).

## Cambios de la Fase 2

- `QuestionType`: +10 tipos del formato 2026 (`READING_COMPLETE_WORDS`, `LISTENING_CHOOSE_RESPONSE`, `WRITING_BUILD_SENTENCE`, `WRITING_EMAIL`,
  `SPEAKING_LISTEN_REPEAT`, `SPEAKING_INTERVIEW`, …).
- `ExamSection`: `module` (1/2) y `variant` (`core|easy|hard`) para el enrutamiento adaptativo.
- `SectionAttempt`: `examSectionId` y `module` (un intento por módulo).
- `Passage`: `kind`, `meta` (cabeceras de email, turnos de diálogo, publicaciones de la discusión…), `bankId`, `sourceRefs` (atribución), `contentFingerprint`.
- `Question`: `taskKind`, `meta` (piezas de *Build a Sentence*, prefijo de *Complete the Words*, audio), `timeLimitSec`.
- `Answer`: `locked`.
- `Recording`: `transcriptSource`, `mimeType`, `analysis`, `score`. `Essay`: `taskType`, `score`.
- `ScoreReport`: `sectionSummary` (módulos, ruta, puntaje, banda, confianza por sección).
- `KnowledgeChunk`: `taskType`, `tags`, `contentHash` (único) + `embedding` — base del RAG.
- Nuevo `SourceDocument`: extractos de fuentes abiertas con licencia y URL.

> Aún no hay carpeta `prisma/migrations`. En desarrollo usa `prisma db push` (el contenedor lo hace solo si no hay migraciones).
> Cuando quieras versionar el esquema: `npx prisma migrate dev --name init` y commitea `prisma/migrations/`.
