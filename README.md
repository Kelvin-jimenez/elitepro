# Elitepro

App de control diario de entreno y nutrición para quien entrena híbrido, crossfit, Hyrox o funcional y además compite o corre.

- Calcula las calorías y los macros de cada día según el entreno que toque.
- Dice qué te falta por comer con lo que ya has apuntado.
- Registra comidas, entrenos (con distancia, pulso y GPX), peso y competiciones.
- Planificación semana a semana, día a día o con una semana fija.

Todo está en un único archivo, `index.html`. Los datos de cada persona se guardan solo en su navegador.

## Cómo está organizado

- `src/elitepro.html`: la fuente (es la versión que se publica dentro de Claude).
- `build.py`: genera `index.html`, la versión web, a partir de la fuente. Se ejecuta con `python3 build.py`.
- `index.html`: lo que sirve la web. No se edita a mano.

## Modo salud

En Datos se puede indicar diabetes o prediabetes, los límites que haya dado el médico y las lesiones o molestias. La app orienta; no sustituye a un médico, no calcula dosis ni cambia medicación.
