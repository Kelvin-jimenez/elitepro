# Elitepro · lo que te toca como responsable de los datos

Al guardar datos de otras personas en tu Drive pasas a ser el **responsable del tratamiento** según el Reglamento General de Protección de Datos (RGPD) y la ley española (LOPDGDD). Esto resume lo que ya hace la app por ti y lo que tienes que hacer tú. Es una guía práctica, no asesoramiento jurídico: antes de abrirlo a gente que no conoces, que lo revise un profesional de protección de datos.

## Lo que ya está resuelto en la app

| Obligación | Cómo se cumple |
|---|---|
| Informar con claridad (arts. 13 RGPD) | Política de privacidad pública (`privacidad.html`), enlazada antes de crear la cuenta. |
| Consentimiento (art. 6.1.a) | Casilla obligatoria, sin marcar por defecto, al crear la cuenta. |
| Consentimiento explícito para salud (art. 9.2.a) | Casilla aparte y opcional. Sin ella, la condición, los límites del médico, la glucosa y las lesiones no salen del dispositivo. |
| Poder demostrar el consentimiento (art. 7.1) | En la hoja queda, por usuario, la versión de la política, la fecha y si consintió los datos de salud. |
| Retirar el consentimiento tan fácil como darlo (art. 7.3) | Casilla de salud en Perfil y botón «Borrar mi cuenta». |
| Acceso y portabilidad (arts. 15 y 20) | «Descargar copia» en Perfil. |
| Rectificación (art. 16) | El usuario edita sus datos en la app. |
| Supresión (art. 17) | «Borrar mi cuenta» elimina su fila del servidor al momento. También puedes borrarla tú desde el panel. |
| Minimización (art. 5.1.c) | Solo se sube lo que la app usa. Sin cuenta, no se sube nada. |
| Seguridad (art. 32) | Cifrado en el dispositivo (AES-256), contraseñas que nunca se envían, invitaciones de un solo uso, freno a los intentos fallidos, sesiones que caducan y se anulan al cambiar la contraseña, llave del responsable fijada en la app. Google solo almacena datos ilegibles. |
| Edad (art. 7 LOPDGDD) | Solo mayores de 18, declarado al registrarse. |

## Lo que tienes que hacer tú

1. **Pon tu nombre y un correo de contacto** en `src/nube.json`. Sin eso la política no es válida.
2. **Protege la cuenta de Google**: verificación en dos pasos, contraseña única, y no compartas la hoja.
3. **Guarda bien la contraseña de entrenador** y no la reutilices.
4. **Atiende las peticiones** de los usuarios sobre sus datos en un mes como máximo.
5. **Revisa cada cierto tiempo** el panel y borra las cuentas sin uso en 24 meses (es lo que promete la política).
6. **Si hay un incidente** (te roban la cuenta, compartes la hoja por error, pierdes un dispositivo con el panel abierto): cambia contraseñas, apunta qué pasó y cuándo, y valora si hay que notificarlo a la Agencia Española de Protección de Datos en un máximo de 72 horas y avisar a los afectados. Como los datos de la hoja están cifrados, un acceso a la hoja sola no expone su contenido; un acceso con tu contraseña de entrenador, sí.
7. **Usa el panel solo para el seguimiento.** Nada de capturas, reenvíos ni usos distintos a los que el usuario aceptó.
8. **Conserva el registro de actividades** (`registro-de-actividades.md`) al día.

## Puntos débiles que debes conocer

- **Cuenta gratuita de Google.** Google no firma contrato de encargado del tratamiento (art. 28 RGPD) con cuentas gratuitas; sí lo hace con Google Workspace. Aquí se compensa con que Google solo recibe datos cifrados que no puede leer, pero si esto crece o lo ofreces como servicio, pasa a Workspace o a un proveedor con contrato.
- **Datos de salud.** Son categoría especial. Si llegas a tratar los de muchas personas, puede hacer falta una evaluación de impacto (art. 35) y revisar si necesitas delegado de protección de datos.
- **Historial de versiones de la hoja.** Google guarda versiones anteriores de la hoja durante un tiempo. Están cifradas igual que el resto, pero significa que un dato borrado (una cuenta, o los datos de salud tras retirar el consentimiento) puede seguir un tiempo en ese historial. No restaures versiones antiguas ni hagas copias de la hoja.
- **Tú puedes leerlo todo.** El usuario lo acepta expresamente, pero eso te obliga a ti a la confidencialidad.
- **Elitepro orienta, no es un servicio sanitario.** No lo presentes como tal.
