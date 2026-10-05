# Poner en marcha la nube de Elitepro en tu Drive

Los datos de los usuarios se guardan en **una hoja de cálculo de tu Google Drive**. Llegan cifrados desde el dispositivo de cada usuario: en la hoja solo se ve su correo, las fechas, el consentimiento que dio y un bloque ilegible. Para leerlos usas el **panel del entrenador** con tu contraseña.

Tiempo: unos 15 minutos. Solo se hace una vez.

## Antes de empezar

- Usa la cuenta de Google que quieras dedicar a esto y **activa en ella la verificación en dos pasos** (myaccount.google.com → Seguridad). Quien entre en esa cuenta puede borrar los datos.
- Ten a mano tu nombre completo y un correo de contacto: salen en la política de privacidad.

## Pasos

1. **Crea la hoja.** En Google Drive: Nuevo → Hojas de cálculo de Google. Ponle de nombre `Elitepro – datos`. No la compartas con nadie, nunca.
2. **Abre el editor.** En la hoja: Extensiones → Apps Script.
3. **Pega el código.** Borra lo que haya en el editor, pega todo el contenido de `nube/Code.gs` y guarda (icono del disquete).
4. **Prepara la hoja.** Arriba, en el desplegable de funciones, elige `prepararElitepro` y pulsa **Ejecutar**.
   - La primera vez Google pide permiso. Verás «Google no ha verificado esta aplicación»: es normal, la aplicación es tuya. Pulsa Configuración avanzada → Ir a (nombre del proyecto) → Permitir.
   - El permiso que se concede es solo sobre **esta hoja**, no sobre el resto de tu Drive.
   - Abajo, en «Registro de ejecución», aparece el **código de puesta en marcha**. Cópialo. Sirve una sola vez.
5. **Publica el servicio.** Arriba a la derecha: Implementar → Nueva implementación → tipo **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**. (Hace falta para que la app pueda llamar al servicio; la seguridad la ponen las cuentas, las invitaciones y el cifrado.)
   - Pulsa Implementar y copia la **URL de la aplicación web** (acaba en `/exec`).
6. **Conecta la app.** Abre `src/nube.json`, pon la URL en `url`, tu nombre en `responsable` y tu correo en `contacto`. Ejecuta `python3 build.py` y sube los cambios. Se generan `index.html`, `panel.html` y `privacidad.html`.
7. **Crea tu llave de entrenador.** Abre `https://TU-WEB/panel.html`, pega el código de puesta en marcha y elige tu contraseña de entrenador (mínimo 12 caracteres). Apúntala en un sitio seguro.
8. **Fija tu llave en la app.** El panel muestra la «huella de tu llave de entrenador» (16 caracteres). Ponla en `src/nube.json`, campo `kid`, ejecuta `python3 build.py` y sube los cambios. Desde ese momento la app solo cifra para tu llave: aunque alguien entrara en tu cuenta de Google, no podría colar la suya.
9. **Invita.** En el panel, «Crear código». Cada código sirve para una cuenta.

## Si cambias el código más adelante

En el editor: Implementar → Gestionar implementaciones → lápiz → Versión: **Nueva versión** → Implementar. La URL no cambia.

## Si olvidas la contraseña de entrenador

Ejecuta otra vez `prepararElitepro` (da un código nuevo), abre el panel, pulsa «He olvidado la contraseña» y repite los pasos 7 y 8 (la huella cambia, así que hay que actualizar `kid` y volver a publicar). Los usuarios no pierden nada: volverás a ver los datos de cada uno cuando abra la app.

## Límites que conviene saber

- Una cuenta gratuita de Google da para un grupo pequeño (decenas de personas). Si crece, hay que pasar a una base de datos de verdad.
- Si un usuario olvida su contraseña, la cambia él mismo con «He olvidado la contraseña»: le llega un código de 6 cifras al correo de su cuenta (lo envía esta cuenta de Google; 15 minutos, un solo uso, como mucho 3 códigos cada media hora). Si lo hace desde un dispositivo con la sesión abierta no pierde nada. Si la sesión está cerrada, la cuenta se queda con lo que haya en ese dispositivo, porque lo de la nube estaba cifrado con la contraseña antigua; si el dispositivo está vacío, descarga antes su copia desde el panel y pásasela para que la recupere.
- La primera vez que publiques una versión con envío de correo, Google pide un permiso nuevo: ejecuta `autorizarCorreo` desde el editor y acéptalo. Una cuenta gratuita puede enviar unos 100 correos al día.
- La primera vez que un dispositivo que ya tenía datos entra en una cuenta, en lo que coincida manda la nube; lo que solo estaba en el dispositivo se conserva y se sube.
- «Empezar de cero» borra lo del dispositivo y lo desconecta; no toca la cuenta. Para borrar la cuenta está «Borrar mi cuenta».
- El servicio es público en internet: alguien podría saturarlo con peticiones y agotar la cuota diaria gratuita de Google (la app seguiría funcionando en local y sincronizaría al día siguiente), pero no leer ni borrar datos.
- Si dos dispositivos del mismo usuario cambian el mismo día a la vez, se queda el último que sincroniza para ese día. Días distintos se juntan sin problema.
