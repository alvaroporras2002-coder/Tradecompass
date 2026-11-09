# Validación de la entrega

Comprobado el 9 de noviembre de 2026:

- Comprobación de sintaxis de todos los módulos JavaScript.
- Pruebas automáticas de dominio, importación, backend, sincronización, almacenamiento y renderizado.
- Compilación estática y Worker sin dependencias de instalación.
- Respuestas HTTP del Worker generado para documento, módulos, estilos, manifest y service worker.
- Todos los recursos declarados en la caché PWA existen.
- Prioridad del respaldo local reciente, lectura con localStorage bloqueado y rechazo explícito de guardados corruptos o errores transitorios de IndexedDB; eliminación del respaldo alternativo solo después de confirmar el guardado durable.
- Estados vacíos y fixtures de prueba en español e inglés; contenido de usuario escapado.
- Los datos de ejemplo se mantienen como fixtures para las pruebas; el inicio de la aplicación utiliza una cuenta vacía con balance inicial 0.

El navegador de pruebas de este entorno no está disponible. No se ha realizado una comprobación visual o táctil en un dispositivo físico ni una prueba de instalación real en Android/iOS. Las pruebas de sincronización usan almacenamiento y solicitudes simuladas; la entrega debe distinguirlas de una prueba entre dos dispositivos de producción.

Prueba manual recomendada: abrir el enlace publicado, registrar una operación, adjuntar una captura, exportar/restaurar JSON, importar y revertir la plantilla MT5; instalar desde el menú del navegador; abrir sin conexión; volver a conectar y comprobar el estado de sincronización en dos dispositivos de la misma sesión.

## Ajuste visual al PDF

La actualización reorganiza el resumen y el diario según las páginas 17 y 22. Añade fuentes locales Manrope/Inter e iconos Phosphor con sus licencias; conserva el modelo de datos. El informe `design-qa.md` registra la comparación visual como bloqueada porque no hay navegador de captura disponible. Las pruebas automáticas no sustituyen esa revisión.

## Inicio vacío y conservación de datos

La app inicia con «Mi cuenta», balance inicial 0 y sin operaciones precargadas. La actualización identifica los ejemplos antiguos que siguen sin editarse; conserva los registros añadidos o modificados por el usuario. Antes de aplicar una limpieza se guarda un respaldo local del estado original. Se conserva la primera copia sin sobrescribirla con limpiezas posteriores. Ajustes permite descargarla; restaurar un JSON antiguo también pasa por esta migración. Si falla el respaldo previo, no debe sustituirse el espacio actual.

Comprobación de esta actualización: validar el inicio vacío, la conservación de datos propios, la descarga del respaldo anterior y la restauración de JSON con ejemplos antiguos. El recuento final de pruebas corresponde a la ejecución completa de la versión entregada.

Validación de esta actualización: 111 pruebas automáticas aprobadas, incluidas captura rápida, limpieza de ejemplos serializados, conservación de datos personales, copia previa y sincronización de la migración con control de versión. Compilación estática y Worker correctas.
