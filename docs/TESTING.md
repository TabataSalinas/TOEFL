# Pruebas

## Unitarias (sin base de datos ni red)
```bash
npm run test --workspace @toefl/api
```
Cubren: blueprint 2026 y puntaje adaptativo; generador C-test y *Build a Sentence*; validación y rebalanceo de claves; banco offline para
**las 12 tareas** del blueprint; prompts y parseo de la salida del LLM; calificación por tipo; métricas de habla (pausas, ritmo, muletillas);
alineación *Listen and Repeat*; heurísticas y agregación de evaluaciones (mediana, anti-alucinación, confianza); recuperación BM25/RRF;
**ausencia de fuga de respuestas** en lo que se sirve durante el examen; planificador del coach.

## Integración / e2e (requiere PostgreSQL)
```bash
docker compose up -d db redis
export DATABASE_URL=postgresql://toefl:toefl_password_change_me@localhost:5432/toefl?schema=public
npx prisma db push --schema apps/api/prisma/schema.prisma
npm run test:e2e --workspace @toefl/api
```
Flujo verificado: registro → generar Reading → servir módulo 1 **sin respuestas** → guardar/finalizar → enrutamiento a módulo 2 → informe
bloqueado hasta terminar → informe con claves; respuestas de Listening **bloqueadas**; orden obligatorio en exámenes completos; rúbricas consultables.

## Qué se verificó en el entorno de desarrollo del asistente
Sin acceso a npm ni Docker, la lógica pura se compiló con `tsc` y se ejecutó con un mini-runner compatible con Jest
(**90 pruebas unitarias pasando**). No se pudieron ejecutar: `nest build`, `next build`, Prisma, e2e ni los flujos de navegador (micrófono,
TTS). Esas verificaciones quedan para tu máquina; reporta cualquier error de compilación y se corrige.
