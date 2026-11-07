# Formato TOEFL iBT (desde el 21 de enero de 2026) y cómo lo implementa la plataforma

La Fase 1 se construyó con el formato anterior. Al revisar el *Practice Test 2* oficial que aportaste
(que solo usamos para **entender el formato**; su contenido no se copia ni se guarda en el repositorio),
la estructura cambió por completo. Esta página resume el formato y su implementación.

## Qué cambió

| | Antes (hasta 2025) | Ahora (2026) |
|---|---|---|
| Orden | Reading, Listening, Speaking, Writing | **Reading → Listening → Writing → Speaking** |
| Reading / Listening | Una sola etapa | **Adaptativos en 2 módulos**: el módulo 2 depende del desempeño en el 1 |
| Escala | 0–30 por sección, 0–120 | **Bandas 1–6** (pasos de 0.5); el 0–120 se reporta de forma comparable durante la transición |
| Duración | ~3 h | ~1 h 30 min de tiempo de trabajo (≈ 2 h con verificaciones) |

## Tareas por sección (según el PDF de práctica y fuentes públicas)

| Sección | Tarea | Ítems | Reloj |
|---|---|---|---|
| Reading (por módulo) | **Complete the Words** (párrafo con letras faltantes) | 10 | módulo ≈ 14 min |
| | **Read in Daily Life** (emails, avisos, flyers) | 5 (2 + 3) | |
| | **Read an Academic Passage** | 5 | |
| Listening (por módulo) | **Listen and Choose a Response** | 8 | reloj por pregunta; el audio se oye **una vez**, sin volver atrás |
| | **Conversations** | 2 × 2 | |
| | **Announcement** | 2 | |
| | **Academic Talk** | 4 | |
| Writing | **Build a Sentence** | 10 | ≈ 6 min |
| | **Write an Email** | 1 | 7 min |
| | **Write for an Academic Discussion** (≥ 100 palabras) | 1 | 10 min |
| Speaking | **Listen and Repeat** | 7 | ~12 s cada uno |
| | **Take an Interview** | 4 | 45 s cada una, sin preparación |

Tiempos totales aproximados publicados por terceros a partir de la especificación de ETS: Reading ≈ 27–30 min,
Listening ≈ 25–29 min, Writing 23 min, Speaking 8 min. Las cifras están en
[`toefl.constants.ts`](../apps/api/src/common/toefl.constants.ts) y son fáciles de ajustar.

> Nota de honestidad: no pude abrir directamente las páginas de ETS desde el sandbox (bloqueo 403), así que los
> tiempos exactos provienen de resúmenes de terceros y de tu PDF. Verifícalos contra
> [ets.org/toefl](https://www.ets.org/toefl/test-takers/ibt/about/content.html) y ajusta las constantes si difieren.

## Cómo se implementa cada regla del examen

| Regla real | Implementación |
|---|---|
| Orden fijo de secciones | `AttemptsService.startSection` rechaza empezar una sección si la anterior no terminó (exámenes `FULL`). |
| Módulos adaptativos | Al terminar el módulo 1 se calcula la precisión y se enruta (`routeModule2`): ≥ 65 % → módulo **difícil**, si no **fácil**. El módulo 2 se genera en ese momento. |
| Reloj imposible de pausar | `deadlineAt` vive en el servidor; los módulos vencidos se cierran solos (aunque cierres el navegador). |
| Reading: Next/Back dentro del módulo, sin volver al anterior | `ReadingRunner` con navegador de preguntas; `finish` es irreversible. |
| Listening: sin volver atrás, audio una vez, reloj por pregunta | `ListeningRunner` bloquea (`lock`) cada respuesta al avanzar; el servidor ignora cambios posteriores. La transcripción **no se envía ni se muestra** durante el examen. |
| Writing: cada tarea con su reloj | `WritingRunner` con reloj por tarea; al vencer, la tarea se bloquea y avanza. |
| Speaking: grabación automática | `SpeakingRunner` reproduce el estímulo, emite un pitido, graba y detiene al terminar el reloj; alerta cuando quedan ≤ 10 s (≤ 3 s en *Repeat*). |
| Sin acceso a respuestas durante el examen | `serve.ts` nunca incluye `correctAnswer` ni `explanation`; `GET /exams/:id` devuelve solo un resumen; el reporte se bloquea hasta terminar. |

## Lo que no se replica (y por qué)

- **Calibración oficial de ETS**: los puntajes son estimaciones internas (ver [`SCORING.md`](SCORING.md)).
- **Ítems preprueba** (no puntuados) y selección adaptativa a nivel de ítem: aquí el enrutamiento es por módulo.
- **Voces y videos oficiales**: el audio usa TTS (OpenAI si hay clave; si no, la voz del navegador).
- **Proctoring**: la cámara es una vista previa local opcional; no se sube ni se analiza (Fase 3).
