# Roadmap por fases

El proyecto se construye por fases para que cada parte quede **funcional de
verdad**, no como esqueleto. El esquema de datos ya contempla todas las fases.

## ✅ Fase 1 — Base + Reading/Listening (esta entrega)

- Monorepo (NestJS + Next.js), Docker Compose, documentación completa.
- Autenticación JWT (registro, login, refresh con rotación, reset).
- Perfil, metas semanales/mensuales, preferencias, racha.
- Generación de exámenes por IA (OpenAI) con **fallback mock determinista**.
- **Reading y Listening** end-to-end:
  - Generación de pasajes/transcripciones y preguntas originales.
  - **Modo examen**: temporizador autoritativo, navegación controlada,
    bloqueo de respuestas, inicio/fin de sección, expiración por tiempo.
  - Calificación automática, explicaciones, detección de skills difíciles.
- **Estimador de score** (0–120 y banda 1–6) con confianza y metodología.
- Reportes por intento, progreso, precisión por skill.
- **Dashboard**: racha, metas, tiempo, readiness, progreso al objetivo.
- **AI Coach**: análisis de debilidades/fortalezas, resumen, plan de estudio
  adaptativo con ganancia estimada de puntos y semanas al objetivo.
- Pruebas unitarias (scoring, generador) y e2e (smoke de API).

## ✅ Fase 2 — Formato 2026, Writing, Speaking y RAG (esta entrega)

- **Rediseño al formato 2026** (ver [`FORMAT_2026.md`](FORMAT_2026.md)): 12 tipos de tarea, módulos adaptativos, orden oficial, relojes por tarea/pregunta.
- **Writing**: *Build a Sentence* (auto), *Email* y *Academic Discussion* con rúbrica, errores corregidos, justificación y versión mejorada.
- **Speaking**: grabación automática, STT (Whisper / navegador), pausas, silencios, ritmo, muletillas, fluidez, continuidad, cumplimiento del tiempo,
  *Listen and Repeat* con alineación palabra a palabra, *Interview* con rúbrica; revisión de grabaciones.
- **RAG**: rúbricas, ejemplos calificados y guías; recuperación híbrida; evaluación con varias muestras y citas.
- **Contenido "ilimitado"** (ver [`CONTENT_SOURCES.md`](CONTENT_SOURCES.md)): generación por IA + control de calidad + antirrepetición + fuentes abiertas con atribución.
- Coach: ejercicios y recursos por habilidad, plan que se regenera solo; analíticas por sección y comparación de intentos.
- TTS en servidor (opcional) y prueba de micrófono/altavoces/cámara previa al examen.

## 🔜 Fase 3 — Inmersión, OAuth y calibración

- **Proctoring**: supervisión con cámara (hoy solo vista previa local), detección de salida de pestaña.
- **OAuth** (Google/GitHub) y entrega de email para reset de contraseña.
- **Calibración**: contrastar tus puntajes estimados con resultados oficiales para ajustar los pesos de `SCORING.md`.
- Pronunciación a nivel fonético (servicio especializado), pre-generación en segundo plano del banco de ítems, importación de textos propios.
- Migraciones Prisma versionadas, CI con e2e en contenedor.

## Notas de diseño que facilitan las fases siguientes

- `AiProvider` desacopla el proveedor de IA (añadir STT/embeddings sin refactor).
- `Recording` y `Essay` ya existen para almacenar artefactos productivos.
- `SectionScore.skillBreakdown` y `Question.skillTag` alimentan el análisis de
  debilidades de todas las secciones.
- El temporizador autoritativo del servidor ya soporta las cuatro secciones.
