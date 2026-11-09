# API REST

Base URL: `http://localhost:4000/api`
Documentación interactiva (Swagger): `http://localhost:4000/api/docs`

Autenticación: `Authorization: Bearer <accessToken>` salvo rutas públicas.

## Auth

| Método | Ruta | Público | Descripción |
|--------|------|---------|-------------|
| POST | `/auth/register` | ✅ | Crea cuenta → `{ accessToken, refreshToken }` |
| POST | `/auth/login` | ✅ | Login → tokens |
| POST | `/auth/refresh` | ✅ | Rota tokens (`{ refreshToken }`) |
| POST | `/auth/logout` | 🔒 | Revoca un refresh token |
| POST | `/auth/forgot-password` | ✅ | Emite token de reset (devuelto/logeado en modo personal) |
| POST | `/auth/reset-password` | ✅ | Cambia contraseña con `{ token, password }` |

## Users

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/users/me` | Usuario + perfil + metas |
| PATCH | `/users/me/profile` | Actualiza nombre, objetivo (0–120), min/día, tema, idioma, fecha |
| GET | `/users/me/goals` | Lista metas |
| POST | `/users/me/goals` | Crea/actualiza meta `{ period: WEEKLY\|MONTHLY, targetMinutes }` |

## Exams

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/exams/generate` | Genera un examen 2026 `{ kind: FULL\|SECTION, section?, difficulty? }`. Construye el módulo 1 de cada sección. Devuelve un **resumen** (sin preguntas ni respuestas). |
| GET | `/exams` | Lista exámenes recientes |
| GET | `/exams/:id` | Resumen del examen (nunca incluye preguntas/respuestas) |

## Attempts (modo examen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/attempts` | Inicia intento `{ examId }` |
| GET | `/attempts` | Historial de intentos |
| GET | `/attempts/:id` | Estado por sección (módulo actual, tiempos). Cierra módulos vencidos. |
| POST | `/attempts/:id/sections/:section/start` | Inicia/reanuda el módulo actual. Devuelve `steps`, `passages`, `questions`, `savedAnswers` (**sin respuestas ni explicaciones**; sin texto en Listening). Exige el orden oficial en exámenes `FULL`. |
| POST | `/attempts/:id/sections/:section/answers` | Guarda respuestas `{ answers: [{ questionId, response, timeSpentSec?, lock? }] }`. Las bloqueadas (`lock`) no cambian. Rechaza tras el `deadlineAt` (+5 s de gracia). |
| POST | `/attempts/:id/sections/:section/finish` | Cierra el módulo, califica y, en Reading/Listening, genera el módulo 2 (`nextModule: 2`). |
| POST | `/attempts/:id/abandon` | Abandona el intento |
| POST | `/attempts/:id/speaking/recordings` | `multipart/form-data`: `audio`, `questionId`, `durationSec`, `clientTranscript?`, `clientConfidence?`, `speechSegments?` (JSON). Transcribe y analiza en el acto. 409 si la pregunta ya tiene grabación. |

`:section` ∈ `READING | LISTENING | WRITING | SPEAKING`.

## Speaking (revisión de grabaciones)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/speaking/recordings` | Mis grabaciones |
| GET | `/speaking/recordings/:id` | Transcripción, métricas, análisis de rúbrica |
| GET | `/speaking/recordings/:id/audio` | Audio (requiere token; usa fetch→blob en el cliente) |

## RAG (rúbricas y ejemplos)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/rag/chunks?taskType=&kind=` | Lista rúbricas / ejemplos calificados / guías |
| GET | `/rag/search?q=&taskType=&kind=` | Búsqueda híbrida (BM25 + embeddings si hay clave) |

## Media

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/media/tts/:file` | Audio sintetizado en caché (requiere token) |

## Reports

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reports/attempts/:id` | Reporte detallado por módulo: respuestas, claves, explicaciones, transcripciones, ensayos con feedback, grabaciones. **403 mientras el intento está en curso.** |
| GET | `/reports/progress` | Evolución de score (total y por sección), tendencia y comparación de los dos últimos simulacros completos |
| GET | `/reports/skills` | Precisión por skill (ítems) y por dimensión de rúbrica (Writing/Speaking) |
| GET | `/reports/timings` | Tiempo promedio de respuesta por tipo de tarea |

## Dashboard

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/dashboard` | Racha, metas, tiempo total, score, readiness, recientes |

## Tutor (AI Coach)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/tutor/analysis` | Debilidades, fortalezas, resumen, semanas estimadas al objetivo |
| POST | `/tutor/plan` | Genera/regenera plan de estudio adaptativo |
| GET | `/tutor/plan` | Plan activo |
| PATCH | `/tutor/plan/items/:itemId` | Cambia estado de un ítem `{ status }` |

## Health

| Método | Ruta | Público | Descripción |
|--------|------|---------|-------------|
| GET | `/health` | ✅ | Estado de API, DB y proveedor IA |

## Ejemplo de flujo (curl)

```bash
API=http://localhost:4000/api

# 1. Login (usuario demo del seed)
TOKENS=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@toefl.local","password":"DemoPass123!"}')
ACCESS=$(echo $TOKENS | npx --yes json accessToken)

# 2. Generar un examen de Reading
EXAM=$(curl -s -X POST $API/exams/generate -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"SECTION","section":"READING","difficulty":"standard"}')

# 3. Iniciar intento, arrancar la sección, responder y finalizar…
```
