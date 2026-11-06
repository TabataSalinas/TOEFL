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

## 🔜 Fase 2 — Speaking, Writing y RAG

- **Writing**: evaluación por IA con rúbrica (gramática, vocabulario,
  organización, coherencia, cohesión, desarrollo), corrección de errores,
  justificación de puntaje y **versión mejorada** del texto.
- **Speaking**:
  - Grabación de audio, **speech-to-text** (transcripción automática).
  - Métricas: fluidez, velocidad de habla, pausas largas, silencios,
    muletillas, claridad, ritmo; evaluación de pronunciación/gramática/
    vocabulario/coherencia.
- **Sistema RAG**: `KnowledgeChunk` + embeddings (migrable a `pgvector`) para
  consultar rúbricas y ejemplos de referencia, mejorando consistencia de las
  calificaciones y fundamentando la retroalimentación.
- Síntesis de audio (TTS) para la narración real de Listening.

## 🔜 Fase 3 — Inmersión y coach avanzado

- **Proctoring/condiciones reales**: solicitud y verificación de cámara/micrófono,
  pruebas previas de audio/vídeo, grabación automática de Speaking con
  inicio/fin por tiempo, alertas de "tiempo por terminar".
- **OAuth** (Google/GitHub) y entrega de email para reset de contraseña.
- Analíticas avanzadas: comparación entre intentos, tiempos promedio por tipo,
  tendencias; revisión de grabaciones anteriores.
- Coach adaptativo que **actualiza el plan automáticamente** según el progreso y
  estima puntos ganables por habilidad con mayor precisión (usando RAG).

## Notas de diseño que facilitan las fases siguientes

- `AiProvider` desacopla el proveedor de IA (añadir STT/embeddings sin refactor).
- `Recording` y `Essay` ya existen para almacenar artefactos productivos.
- `SectionScore.skillBreakdown` y `Question.skillTag` alimentan el análisis de
  debilidades de todas las secciones.
- El temporizador autoritativo del servidor ya soporta las cuatro secciones.
