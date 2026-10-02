# Elitepro

App de control diario de entreno y nutrición para quien entrena híbrido, crossfit, Hyrox o funcional y además compite o corre.

- Calcula las calorías y los macros de cada día según el entreno que toque.
- Dice qué te falta por comer con lo que ya has apuntado.
- Registra comidas, entrenos (a mano o con el archivo del reloj), peso y competiciones.
- Planificación semana a semana, día a día o con una semana fija.

Todo está en un único archivo, `index.html`. Los datos de cada persona se guardan solo en su navegador.

## Cómo está organizado

- `src/elitepro.html`: la fuente (es la versión que se publica dentro de Claude).
- `build.py`: genera `index.html`, la versión web, a partir de la fuente. Se ejecuta con `python3 build.py`.
- `index.html`: lo que sirve la web. No se edita a mano.

- `src/elitepro.fase1.html`: copia de seguridad de la fuente antes del rediseño de panel (fase 2).

## Pantallas

- **Hoy**: panel con el objetivo del día (anillo de progreso), macros, entreno, comidas por momento, lo que falta y el peso. No hay formularios a la vista.
- **Semana**: tira L–D con indicadores, resumen semanal y una tarjeta por día con su estado.
- **Progreso**: métricas, Elite Score y gráficas de peso, calorías, proteína, entrenos, distancia y pulso.
- **Competiciones**: cuenta atrás de la prueba objetivo y calendario de pruebas.
- **Perfil**: datos, plan semanal, salud, lesiones, personas y copia de seguridad.

Los formularios (comida, entreno, peso, glucosa, competición, entreno previsto) se abren en una hoja: desde abajo en móvil, centrada en escritorio. En móvil el botón `+` de la barra inferior abre el menú rápido.

## Entrenos desde el reloj

«Importar del reloj» lee el archivo de la actividad y rellena el formulario para revisarlo antes de guardar:

- `.fit` (el original de Garmin y de casi todos los relojes): deporte, duración, distancia, pulso medio y calorías, del resumen de la sesión.
- `.tcx`: lo mismo, sumando las vueltas.
- `.gpx`: recorrido, tiempo y pulso (no trae calorías).
- `.zip`: el que descarga Garmin Connect con «Exportar original»; se abre y se lee el archivo que lleva dentro.

En Garmin Connect se exporta desde el navegador: actividad → rueda dentada → Exportar. No hay conexión directa con la cuenta de Garmin: su API solo se da a empresas aprobadas y necesita un servidor, y esta app es una página sin servidor.

La distancia solo se pide en los deportes que la tienen (carrera, series, híbrido, bici, patines, competición). En fuerza, crossfit, funcional, combate, natación o movilidad el campo no aparece.

## Elite Score

Índice interno de cumplimiento de 0 a 100 sobre los últimos 7 días. No es una valoración médica. Es la media de los componentes que tengan datos:

- **Entrenamiento** = días con entreno previsto en los que se registró un entreno ÷ días con entreno previsto × 100.
- **Nutrición** = media, entre los días con comidas apuntadas, de `0,6 × calorías + 0,4 × proteína`. Calorías vale 100 si lo comido queda a ±10 % del objetivo del día y baja de forma lineal hasta 0 al ±40 %. Proteína es el porcentaje del objetivo alcanzado, con tope en 100.
- **Constancia** = días con algún registro (comida, entreno, peso o glucosa) ÷ 7 × 100.
- **Recuperación**: no se calcula. La app no recoge sueño ni descanso, así que no entra en la media.

Los porcentajes de la primera fila de Progreso usan las mismas fórmulas con 28 días (entrenamientos) y 14 días (nutrición).

**Carga estimada** del entreno: sale del gasto calculado para esa sesión. Menos de 250 kcal, baja; de 250 a 499, media; 500 o más, alta. Es una regla orientativa propia de la app.

## Modo salud

En Perfil se puede indicar diabetes o prediabetes, los límites que haya dado el médico y las lesiones o molestias. La app orienta; no sustituye a un médico, no calcula dosis ni cambia medicación.

## Diseño

Tema oscuro con amarillo por defecto. El botón redondo de la cabecera cambia entre claro y oscuro y lo recuerda en ese navegador. Los colores se definen una sola vez, al principio del `<style>`; la capa de diseño está al final del mismo bloque.
