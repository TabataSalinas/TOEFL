# Cómo se calcula el puntaje (estimación interna)

> Las fórmulas son **aproximaciones para estudio**. ETS no publica su equiparación, así que estos números no
> equivalen a un puntaje oficial. Se muestran con un **nivel de confianza** y una explicación en cada reporte.

## Reading y Listening (adaptativos)

1. Cada módulo se califica por ítem (opción múltiple, *Complete the Words* por letras faltantes sin distinguir mayúsculas).
2. **Enrutamiento**: precisión del módulo 1 ≥ 0.65 → módulo 2 *difícil*; si no, *fácil*.
3. Compuesto = `0.4 × precisión(M1) + 0.6 × precisión(M2)`.
4. Puntaje de sección (0–30): ruta fácil `round(compuesto × 24)` (tope 24); ruta difícil `round(6 + compuesto × 24)` (rango 6–30).
5. Confianza: crece con el número de ítems calificados (hasta 0.95) y se atenúa si falta un módulo.

## Writing (0–30)

`ratio = 0.20 × exactitud(Build a Sentence) + 0.35 × (Email/5) + 0.45 × (Discussion/5)` → `round(ratio × 30)`.

- **Build a Sentence**: coincidencia exacta del orden de las piezas (sin distinguir mayúsculas).
- **Email**: 4 criterios 0–5 (cumplimiento de la tarea, organización/coherencia, gramática, vocabulario/registro).
- **Discussion**: 4 criterios 0–5 (contribución, desarrollo/apoyo, coherencia/cohesión, uso del lenguaje).

## Speaking (0–30)

`ratio = 0.40 × (media Listen and Repeat / 5) + 0.60 × (media Interview / 5)` → `round(ratio × 30)`.

- **Listen and Repeat**: se alinea palabra a palabra la repetición reconocida con la oración objetivo; exactitud ≥ 95 % → 5, ≥ 85 → 4,
  ≥ 70 → 3, ≥ 50 → 2, ≥ 25 → 1, si no 0. Es un *proxy* de inteligibilidad, **no** una medición fonética de pronunciación.
- **Interview**: 7 dimensiones 0–5 combinadas con pesos `grammar 15 %, vocabulary 15 %, coherence 15 %, topic_development 20 %,
  fluency 20 %, pace 5 %, clarity 10 %`. Las dimensiones se obtienen así:

| Dimensión | Origen | Cómo |
|---|---|---|
| fluency, pace, time_use | **Código (audio)** | pausas ≥ 1.5 s, silencios ≥ 3 s, muletillas/min, repeticiones, ratio de habla, palabras/min, tiempo usado vs. objetivo |
| pronunciation, clarity | **Proxy del reconocedor** | confianza de Whisper (`avg_logprob`) o del navegador; no se evalúa si no hay confianza |
| grammar, vocabulary, coherence, topic_development | **LLM + RAG** (o heurística) | rúbrica + ejemplos calibrados; mediana de varias muestras |

Los umbrales (`pausa ≥ 0.5 s`, `pausa larga ≥ 1.5 s`, `silencio ≥ 3 s`, `ritmo cómodo 110–170 wpm`) están en `speech-metrics.ts`.

## Total y banda

- `FULL`: suma de las cuatro secciones (0–120); una sección sin calificar se estima con el promedio de las calificadas (se indica).
- `SECTION`: la sección se proyecta a 0–120 (`sección / 30 × 120`).
- Banda 1–6 (pasos de 0.5): `1 + (puntaje / máximo) × 5`, redondeada a 0.5.

## Consistencia de las evaluaciones con IA (RAG)

1. **Rúbrica determinista**: siempre se inyecta la misma rúbrica de la tarea (no depende de la búsqueda).
2. **Anclas**: se recuperan por similitud (BM25 + embeddings, fusión RRF) ejemplos ya calificados.
3. **Temperatura baja** y salida JSON estricta.
4. **Varias muestras** (`EVAL_SAMPLES`, por defecto 2): mediana por dimensión; la dispersión baja la confianza.
5. **Anti-alucinación**: las "correcciones" cuya cita no aparece literalmente en tu texto se descartan.
6. **Sin LLM**: heurística determinista (cobertura de puntos, longitud, estructura, patrones de error, variedad léxica) con confianza ≤ 0.35.
