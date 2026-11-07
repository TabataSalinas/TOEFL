# Fuentes de contenido y estrategia para exámenes "ilimitados"

Objetivo: poder generar un número muy grande de simulacros **distintos**, parecidos al examen real,
**sin copiar material protegido de ETS** y con trazabilidad de licencias.

## 1. Qué se investigó

| Fuente | Para qué sirve | Licencia / condiciones | Verificado en esta sesión |
|---|---|---|---|
| ETS — contenido y estructura del TOEFL iBT 2026, especificaciones y FAQ | Formato, tareas, número de ítems, tiempos | Contenido de ETS: **no se reutiliza**, solo se lee el formato | Búsqueda (no pude abrir las páginas: 403) |
| Resúmenes de terceros (Magoosh, Lingoleap, BestMyTest) | Confirmar conteos/tiempos (p. ej. Speaking 7 + 4 ítems, 45 s) | Solo lectura | Búsqueda |
| **OpenStax** (libros de texto abiertos) | Hechos y vocabulario académico para temas de Biología, Psicología, Economía, etc. | Mayoría **CC BY 4.0** (atribución). Algunos libros son **CC BY-NC-SA**: revisa cada libro | Sí |
| **Wikipedia** (API de MediaWiki) | Extractos factuales para fundamentar pasajes | **CC BY-SA 4.0**; la API exige `User-Agent` descriptivo | Sí (política de User-Agent) |
| **NASA** (ciencia de la Tierra y espacio) | Hechos de astronomía/ciencias de la Tierra | Generalmente sin copyright en EE. UU.; **citar a NASA** y no sugerir respaldo | Sí |
| Project Gutenberg, USGS, NOAA | Textos de dominio público / datos del gobierno de EE. UU. | Dominio público (en EE. UU.) | **No verificado**: confirma la licencia página por página |
| Recursos de estudio para el *coach* | Purdue OWL, Academic Phrasebank (U. Manchester), VOA Learning English, BBC Learning English, MIT OpenCourseWare, TED-Ed | Solo se **recomiendan** como enlaces; no se copian | Conocimiento general (sin verificar licencias porque no se copian) |

Fuentes consultadas (búsqueda): [ETS — Score scale update](http://www-redirect.aux.ets.org/toefl/institutions/ibt/score-scale-update.html),
[ETS — Understanding score displays](https://www.ets.org/content/ets-org/ca/en/toefl/blog/understanding-toefl-ibt-score-displays.html),
[Lingoleap — 2026 format](https://lingoleap.ai/toefl/2026-format), [Magoosh — Writing practice](https://magoosh.com/toefl/toefl-writing-practice/),
[OpenStax — customizing content](https://openstax.org/blog/customizing-openstax-content),
[Creative Commons — CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.en),
[Wikimedia — API access policy](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy),
[NASA — media usage guidelines](https://go.nasa.gov/33TdFRx).

## 2. Cómo se logra la variedad

```
Taxonomía de temas ──┐
Géneros y escenarios ─┼─► Prompt por tarea ─► LLM (original) ─► Validación ─► Rebalanceo de claves ─► Examen
Hechos abiertos ──────┘        ▲                                   │
Historial del usuario ─────────┘                          Rechazo + reintento
(temas, ids, textos vistos)                               (similitud, claves, longitud)
```

1. **Taxonomía** (`content/topics.ts`): 13 campos académicos con 154 subtemas, 6 géneros de la vida diaria × 20 escenarios,
   16 escenarios de conversación, 12 de anuncios, 16 temas de entrevista, 10 escenarios de email y 10 de discusión.
   Solo como semillas para los prompts, el espacio de combinaciones supera los 56 millones; el LLM convierte cada
   combinación en texto original distinto.
2. **Generación original por IA** (`ai/llm-task.ts`): un prompt por tarea imita el *formato* (no el contenido) y fija tipos de
   pregunta, longitudes, distractores plausibles y nivel CEFR según la dificultad del módulo.
3. **Fundamentación opcional en fuentes abiertas** (`sources/`): con `SOURCES_ENABLED=true` se obtiene un extracto de Wikipedia
   del subtema, se guarda con licencia y URL (`SourceDocument`) y se pasa al modelo **solo como base factual**; el pasaje se
   escribe con palabras propias. La atribución queda en `Passage.sourceRefs` y se muestra en el reporte.
4. **Control de calidad automático** (`content/quality.ts`): conteo de preguntas, 4 opciones únicas, clave válida, longitud del texto,
   nivel de lectura (Flesch–Kincaid) y **similitud con textos vistos** (4-gramas, Jaccard). Si falla, el modelo recibe los motivos y reintenta.
5. **Verificación ciega de claves**: una segunda llamada responde las preguntas sin ver la clave; si discrepa en > 20 %, se rechaza el ítem.
6. **Rebalanceo de claves**: las respuestas correctas se reparten uniformemente entre A–D (los LLM sesgan hacia B/C).
7. **Memoria por usuario**: se evitan temas, ids del banco y textos de tus últimos ~8 exámenes.
8. **Tareas generadas por código** (válidas con cualquier texto): *Complete the Words* (principio C-test, `content/ctest.ts`) y
   *Build a Sentence* (`content/build-sentence.ts`).

## 3. Límites (importante)

- **Sin `OPENAI_API_KEY`** el contenido sale del **banco original incluido** (4 pasajes académicos, 4 textos de vida diaria,
  22 respuestas cortas, 4 conversaciones, 3 anuncios, 4 charlas, 6 párrafos C-test, 42 oraciones, 4 sets *Repeat*, 4 de *Interview*,
  6 emails, 6 discusiones). Es suficiente para probar todo el flujo, pero **se repetirá pronto**. La variedad "ilimitada" requiere el LLM.
- La calidad del LLM no está garantizada: los controles reducen, no eliminan, errores de clave o sesgo. Revisa explicaciones dudosas.
- Los hechos de Wikipedia/OpenStax pueden estar incompletos o desactualizados; el modelo podría introducir errores.
- Wikipedia es CC BY-SA: si redistribuyes los ítems generados, evalúa la obligación de *share-alike*. Para uso personal no aplica,
  pero la atribución se guarda igualmente.
- Las cifras de tiempo y ponderación son aproximaciones; ver [`FORMAT_2026.md`](FORMAT_2026.md) y [`SCORING.md`](SCORING.md).

## 4. Cómo añadir una fuente nueva

1. Verifica su licencia y conserva `license` + `url`.
2. Implementa un método análogo a `SourcesService.groundingFor` que devuelva `GroundingDoc[]`.
3. Úsalo en `ExamBuilderService.generateTask` para los tipos de tarea que quieras fundamentar.

## 5. Ideas siguientes

Importar tus propios textos abiertos (pegar un párrafo → *Complete the Words*); ingesta masiva de OpenStax por capítulos;
banco generado y cacheado en segundo plano para que "Generar examen" sea instantáneo.
