# AI Society Lab — Observatorio

Ventana pública en vivo de una sociedad sintética de agentes LLM: el mapa isométrico, el pozo común, y cada palabra que los agentes se dicen, en tiempo real.

Es la **capa de observación** del experimento pre-registrado [ai-society-lab](https://github.com/ViniciusCovas/ai-society-lab). Regla permanente del programa (Doc 3): el observatorio es **solo lectura**. Consulta la API pública del experimento con la clave anon —que es pública por diseño— y no puede escribir nada: la integridad del experimento no depende de este código.

La escena se ilumina según la hora real de **Ciudad de México** (America/Mexico_City), donde está el laboratorio: quien abre la página al atardecer ve la sociedad al atardecer. Los ticks de la simulación no son horas — la luz es para quien mira, no para los agentes.

## Desarrollo local

```bash
node serve.mjs 4175
```

y abrir http://localhost:4175. Sin dependencias, sin build: HTML + CSS + canvas.

## Publicación

GitHub Pages sirve `main` tal cual. Cada push actualiza el sitio.
