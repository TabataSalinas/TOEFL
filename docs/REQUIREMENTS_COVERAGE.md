# Cobertura de requisitos

Estado de cada punto de la solicitud original. ✅ implementado · 🟡 parcial (ver nota) · ❌ pendiente.

| # | Requisito | Estado | Dónde / nota |
|---|---|---|---|
| 1 | Simulacros con las 4 secciones, tiempos y dificultad similares | ✅ | Formato 2026 completo, `docs/FORMAT_2026.md`; dificultad = enrutamiento adaptativo + selector |
| 1 | Preguntas originales con IA, sin repetición frecuente | ✅ / 🟡 | Ilimitado con `OPENAI_API_KEY`; sin clave el banco offline es pequeño y se repite |
| 1 | Simulacro completo o por sección | ✅ | Practice |
| 2 | Modo examen: cronómetro, navegación controlada, bloqueo de respuestas, inicio/fin automático | ✅ | Reloj de servidor, cierre automático de módulos vencidos, orden oficial |
| 3 | IA: generar, explicar, analizar errores, fortalezas/debilidades, tutor, plan, progreso | ✅ | `ai/`, `tutor/`, `reports/` |
| 4 | Reading/Listening: calificación, explicación, temas difíciles | ✅ | Reporte por módulo y por tipo de tarea |
| 4 | Speaking: pronunciación, fluidez, gramática, vocabulario, claridad, coherencia, desarrollo, ritmo + transcripción + errores + mejoras | ✅ / 🟡 | Pronunciación y claridad = *proxy* de la confianza del reconocedor, no medición fonética |
| 4 | Writing: 7 criterios, correcciones, justificación, versión mejorada | ✅ / 🟡 | Correcciones y versión mejorada requieren LLM; sin clave, heurística de baja confianza |
| 5 | Estimador 0–120 por sección, total, confianza, explicación | ✅ | `docs/SCORING.md`; también bandas 1–6 |
| 6 | Reportes: por simulacro, por sección, gráficas, comparación, tendencias, tiempo promedio, precisión por tipo, historial | ✅ | History, Report |
| 7 | Dashboard: rachas, metas semanal/mensual, tiempo total, historial, evolución, áreas de mejora, preparación, % hacia el objetivo | ✅ | Dashboard |
| 8 | Registro, login, recuperación de contraseña, perfil, metas, historial, grabaciones y ensayos, preferencias | ✅ / 🟡 | La recuperación muestra el código en pantalla (no hay proveedor de email) |
| 8 | OAuth | ❌ | Campos en BD listos; Fase 3 |
| 9 | Voz a texto, pronunciación, fluidez, velocidad, claridad, pausas excesivas, silencios, muletillas | ✅ / 🟡 | Whisper con clave; si no, reconocimiento del navegador (Chrome/Edge) |
| 10 | RAG: rúbricas, ejemplos de referencia, consistencia, retroalimentación fundamentada | ✅ | `rag/`, página Rubrics, citas en cada evaluación |
| 11 | Evaluación justificada, con criterios, errores y recomendaciones accionables, consistente | ✅ | Mediana de varias muestras, filtro anti-alucinación |
| 12 | Cámara y micrófono: permisos, pruebas previas de audio/video | ✅ | Prueba de equipo antes de Speaking |
| 12 | Grabación automática de inicio/fin, almacenamiento, transcripción, métricas, alertas de tiempo, revisión de grabaciones | ✅ | SpeakingRunner, Recordings |
| 12 | Supervisión real con cámara durante el examen | ❌ | Solo vista previa local; Fase 3 |
| 13 | Coach: errores, patrones, prioridades, ejercicios, recursos, plan, puntos ganables, tiempo estimado, actualización automática | ✅ | El plan se regenera al terminar cada intento |
| — | Stack: Next.js, React, TS, Tailwind, NestJS, PostgreSQL, Redis, JWT, OpenAI, Docker | ✅ / 🟡 | Componentes propios estilo shadcn/ui (no la librería). Redis está conectado pero apenas se usa |
| — | Entregables: código, arquitectura, BD, API, pruebas unitarias e integración, instalación, despliegue, doc técnica y funcional | ✅ | `docs/` |

## Riesgos conocidos

- El asistente que escribió el código no pudo compilar ni ejecutar la app en su entorno (sin npm ni Docker). Las 90 pruebas unitarias sí
  se ejecutaron; los flujos de navegador (micrófono, voz, relojes) solo se pueden validar en tu máquina.
- No hay migraciones versionadas: el esquema se aplica con `prisma db push`.
- Los puntajes son estimaciones internas, no equivalencias oficiales de ETS.
