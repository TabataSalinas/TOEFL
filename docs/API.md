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
| POST | `/exams/generate` | Genera examen `{ kind: FULL\|SECTION, section?, difficulty? }` |
| GET | `/exams` | Lista exámenes recientes |
| GET | `/exams/:id` | Blueprint del examen |

## Attempts (modo examen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/attempts` | Inicia intento `{ examId }` |
| GET | `/attempts` | Historial de intentos del usuario |
| GET | `/attempts/:id` | Estado del intento (secciones + temporizadores) |
| POST | `/attempts/:id/sections/:section/start` | Inicia sección y entrega preguntas (**sin respuestas**) |
| POST | `/attempts/:id/sections/:section/answers` | Guarda respuestas `{ answers: [{ questionId, response, timeSpentSec? }] }` |
| POST | `/attempts/:id/sections/:section/finish` | Finaliza y califica (objetivo) |
| POST | `/attempts/:id/abandon` | Abandona el intento |

`:section` ∈ `READING | LISTENING | SPEAKING | WRITING`.

## Reports

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reports/attempts/:id` | Reporte detallado (revela respuestas y explicaciones) |
| GET | `/reports/progress` | Evolución de score para gráficas |
| GET | `/reports/skills` | Precisión por skill/tipo de pregunta |

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
