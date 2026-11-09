# Validación de la entrega

Comprobado el 9 de noviembre de 2026:

- Comprobación de sintaxis de todos los módulos JavaScript.
- 68 pruebas automáticas de dominio, importación, backend, sincronización, almacenamiento y renderizado.
- Compilación estática y Worker sin dependencias de instalación.
- Respuestas HTTP del Worker generado para documento, módulos, estilos, manifest y service worker.
- Todos los recursos declarados en la caché PWA existen.
- Prioridad del respaldo local reciente, lectura con localStorage bloqueado y rechazo explícito de guardados corruptos o errores transitorios de IndexedDB; eliminación del respaldo alternativo solo después de confirmar el guardado durable.
- Estados vacíos y demostración en español e inglés; contenido de usuario escapado.
- Datos de demostración coherentes: 49 operaciones, dos cuentas separadas.

El navegador de pruebas de este entorno no está disponible. No se ha realizado una comprobación visual o táctil en un dispositivo físico ni una prueba de instalación real en Android/iOS. Las pruebas de sincronización usan almacenamiento y solicitudes simuladas; la entrega debe distinguirlas de una prueba entre dos dispositivos de producción.

Prueba manual recomendada: abrir el enlace publicado, registrar una operación, adjuntar una captura, exportar/restaurar JSON, importar y revertir la plantilla MT5; instalar desde el menú del navegador; abrir sin conexión; volver a conectar y comprobar el estado de sincronización en dos dispositivos de la misma sesión.
