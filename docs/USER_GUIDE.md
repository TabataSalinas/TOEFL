# Guía funcional (manual de usuario)

## 1. Primer uso
1. Regístrate o entra con el usuario demo (`demo@toefl.local` / `DemoPass123!`).
2. En **Settings** define tu puntaje objetivo (0–120), fecha de examen, minutos diarios y metas semanal/mensual.

## 2. Practicar
**Practice** ofrece un simulacro completo (≈ 1 h 30) o una sola sección. Elige dificultad (afecta a los módulos generados).
La generación puede tardar unos segundos (más con IA).

### Antes de empezar
- Usa **auriculares** y un lugar silencioso. Para Speaking se pide **permiso de micrófono** y una **prueba de equipo**
  (medidor de entrada, prueba de altavoces, vista previa opcional de cámara — local, no se sube).
- Navegadores recomendados: Chrome o Edge (la transcripción del navegador y la voz sintetizada funcionan mejor).

### Durante el examen
| Sección | Qué verás | Reglas |
|---|---|---|
| Reading | *Complete the Words*, textos de la vida diaria, pasaje académico | Siguiente/Atrás **dentro** del módulo; al terminarlo no puedes volver |
| Listening | Audio sin texto, preguntas una por una | El audio suena **una vez**; reloj por pregunta; sin volver atrás |
| Writing | *Build a Sentence*, email (7 min), discusión (10 min) | Cada tarea tiene su reloj y se bloquea al terminar |
| Speaking | Pitido → grabación automática | Se detiene sola al acabar el reloj; aviso cuando queda poco; no se puede repetir |

El reloj lo controla el servidor: si cierras la pestaña, el módulo se cierra solo al vencer.

## 3. Resultados
En **History** abre un intento para ver:
- Puntaje total estimado (0–120 y banda 1–6), **confianza** y la **explicación del cálculo**.
- Por sección: puntaje, ruta adaptativa, precisión por tipo de tarea, tiempo promedio por pregunta.
- Reading/Listening: cada respuesta, la clave y la explicación (y la transcripción de los audios).
- Writing: criterios de rúbrica, "por qué este puntaje", errores corregidos, acciones recomendadas y **versión mejorada**.
- Speaking: audio, transcripción, tiempo usado/restante, ritmo, pausas largas, silencios, muletillas, cumplimiento del tiempo,
  criterios y recomendaciones. En *Listen and Repeat*, palabras omitidas/sustituidas/extra.

**Recordings** reúne todas tus grabaciones para escucharlas de nuevo. **Rubrics** permite consultar las rúbricas y los ejemplos
calificados que usa la IA, con búsqueda.

## 4. Coach, plan y dashboard
- **AI Coach**: debilidades y fortalezas, resumen, semanas estimadas hasta tu objetivo y un **plan de estudio** con ejercicios,
  recursos y puntos estimados por ganar. Se **regenera automáticamente** al terminar cada intento.
- **Dashboard**: racha, tiempo estudiado, metas, evolución del puntaje, nivel de preparación y avance hacia el objetivo.

## 5. Sin clave de OpenAI
La app funciona con el banco original incluido: se generan los 12 tipos de tarea, se califica Reading/Listening, y Writing/Speaking
usan evaluación heurística de baja confianza (se indica en pantalla). Para correcciones, versión mejorada, transcripción de servidor
y variedad ilimitada, configura `OPENAI_API_KEY`.
