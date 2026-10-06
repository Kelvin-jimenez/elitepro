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
- `manifest.webmanifest`, `sw.js`, `icons/`: hacen que la web se pueda instalar en el móvil (icono, pantalla completa) y que abra sin conexión. Con red, `sw.js` pide siempre la página al servidor; sin red, sirve la última copia. Los iconos se regeneran con `node src/hacer_iconos.mjs`.
- `version.json`: huella de la última publicación. La web la consulta al abrirse y al volver a ella; si es distinta de la suya, se recarga sola (o avisa con un botón si hay un formulario a medias).

- `src/elitepro.fase1.html`: copia de seguridad de la fuente antes del rediseño de panel (fase 2).

## Pantallas

- **Hoy**: panel con el objetivo del día (anillo de progreso), macros, entreno, comidas por momento, lo que falta y el peso. No hay formularios a la vista.
- **Semana**: tira L–D con indicadores, resumen semanal y una tarjeta por día con su estado.
- **Progreso**: métricas, Elite Score y gráficas de peso, calorías, proteína, entrenos, distancia y pulso.
- **Competiciones**: cuenta atrás de la prueba objetivo y calendario de pruebas.
- **Perfil**: datos, plan semanal, salud, lesiones, personas y copia de seguridad.

Los formularios (comida, entreno, peso, glucosa, competición, entreno previsto) se abren en una hoja: desde abajo en móvil, centrada en escritorio. En móvil el botón `+` de la barra inferior abre el menú rápido.

## Comidas, plan pautado y recordatorios

- **Varios ingredientes por comida**: cada momento del día tiene un botón `+`. La hoja enseña lo que ya llevas en ese momento con su suma, y «+ Añadir otro» guarda el ingrediente y deja la hoja abierta para el siguiente. Cada ingrediente es una entrada más de `meals`, como siempre.
- **Plan pautado** (`profile.diet`): el plan de comidas que le ha dado su nutricionista, por comidas (`slots`) o solo con los totales del día (`tot`). En Hoy se compara con lo que pide el día según el entreno: encaja si queda a ±10 %, se queda corto por debajo y sobra por encima; se indica el macronutriente que más pesa en la diferencia. Es una orientación y así se dice en pantalla. Los momentos vacíos ofrecen «Apuntar lo pautado».
- **Recordatorios** (`profile.rem` y `profile.medrem`): avisos de comida, hidratación, medicación u otros, con hora y días. Cada uno abre Google Calendar con el evento relleno y repitiéndose; en la web, además, se descargan todos en un `.ics`. Los de medicación van aparte y no se suben a la nube.

## Buscador, «mis platos» y asistente

- **Buscar al escribir**: en «Qué has comido» salen sugerencias de una lista de más de 300 alimentos y platos (sin tildes, con las palabras en cualquier orden). Al elegir una se rellenan la ración y los macros.
- **Sólidos en gramos, líquidos en mililitros**: la cantidad lleva unidad (g, ml o l). Al elegir una bebida o un líquido pasa sola a ml; a partir de 1 l se enseña en litros. En los datos, `u: "ml"` en una comida dice que `g` son mililitros.
- **Mis platos** (`profile.foods`): lo que se apunta a mano y no está en la lista se recuerda (casilla marcada por defecto) y la próxima vez sale al buscarlo, marcado como «Tuyo». Varias cosas de un mismo momento del día se pueden guardar juntas como un plato. Se quitan desde «Buscar en la lista».
- **Plan pautado desde un documento**: en «Tu plan pautado», «Subir mi plan en PDF o foto». El PDF se abre en el propio navegador con pdf.js (va en `vendor/pdfjs`, sin pedirlo a terceros): cada página se pasa a imagen y, si el PDF trae texto, se acompaña. La IA lo lee por tandas de 4 páginas (hasta 120 páginas; si una respuesta llega cortada, la tanda se parte en dos) y lo deja por **tipos de día** (intenso, descanso, 48 h antes, competición, días de la semana…), con sus momentos, sus opciones y la tabla de cantidades por sexo y peso. En Hoy la app elige el tipo de día según el entreno y las competiciones, enseña las opciones con las cantidades de la persona y se apuntan con un toque. Con «Deshacer».
- **Objetivo del día con plan pautado**: si el plan marca un menú cerrado, el objetivo del día es el plan y el cálculo de la app se enseña como estimación con su margen (10–15 %); si el plan deja elegir entre opciones, o suma menos que el gasto en reposo, el objetivo sigue siendo el cálculo de la app. Se cambia en «Ver o cambiar el plan».
- **Asistente** (`sample`): se le escribe o se le manda una foto y apunta comidas y entrenos (con «Deshacer»), y contesta dudas del día con el contexto de la semana. Dentro de Claude usa la IA de quien abre la app; en la web pasa por el servidor (operación `ai`) con la clave de la API de Anthropic guardada allí. No recibe datos de salud y la conversación no se guarda.

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

## Cuenta en la nube (opcional)

Por defecto los datos de cada persona se quedan en su navegador. Si en `src/nube.json` se pone la dirección de un servidor, la web añade en Perfil una cuenta en la nube y se generan dos páginas más: `panel.html` (para el entrenador) y `privacidad.html`.

- El servidor es un script de Google (`nube/Code.gs`) dentro de una hoja de cálculo del Drive del responsable. Cómo montarlo: `nube/PUESTA-EN-MARCHA.md`.
- Los datos se cifran en el dispositivo antes de enviarse. En la hoja solo quedan el correo, las fechas, el consentimiento y un bloque ilegible. Pueden descifrarlos el usuario, con su contraseña, y el responsable, con su contraseña de entrenador.
- Las cuentas se crean con código de invitación. Los datos de salud solo se suben con un consentimiento aparte.
- Obligaciones del responsable y textos legales: carpeta `legal/`.

## Pruebas

En `pruebas/`, con Node y Playwright:

- `node pruebas/app.test.mjs index.html`: la app (61 comprobaciones).
- `node pruebas/reloj.test.mjs index.html`: importación de archivos del reloj.
- `node pruebas/plan.test.mjs index.html`: ingredientes por comida, plan pautado y recordatorios.
- `node pruebas/api.test.mjs`: el servidor, con una imitación local de los servicios de Google.
- `ELITEPRO_NUBE_URL=/api python3 build.py /tmp/ep/index.html && node pruebas/nube.test.mjs /tmp/ep`: cuenta en la nube de punta a punta (dos dispositivos y el panel).
- `node pruebas/pwa.test.mjs /tmp/ep`: app instalable, uso sin conexión y aviso de cuenta en Hoy.
- `node pruebas/version.test.mjs /tmp/ep`: actualización automática.
- `node pruebas/nube2.test.mjs /tmp/ep`: casos límite (guardados en curso, volver a entrar, empezar de cero, cambio de contraseña).
- `node pruebas/ia.test.mjs /tmp/ep`: buscador de alimentos, «mis platos» e IA fuera de Claude (foto, calcular y asistente) con una imitación de la API.
- `node pruebas/plan2.test.mjs /tmp/ep`: plan pautado leído de un PDF largo (tandas, respuesta cortada, páginas que fallan), tipos de día, opciones, cantidades por sexo y peso y objetivo del día.
- `node pruebas/clave.test.mjs /tmp/ep`: botón de ver la contraseña y «He olvidado la contraseña» (código por correo, con y sin la llave en el dispositivo).

## Modo salud

En Perfil se puede indicar diabetes o prediabetes, los límites que haya dado el médico y las lesiones o molestias. La app orienta; no sustituye a un médico, no calcula dosis ni cambia medicación.

## Diseño

Tema oscuro con amarillo por defecto. El botón redondo de la cabecera cambia entre claro y oscuro y lo recuerda en ese navegador. Los colores se definen una sola vez, al principio del `<style>`; la capa de diseño está al final del mismo bloque.
