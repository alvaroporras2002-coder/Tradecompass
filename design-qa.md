# Portal iPhone — referencia visual 44

Se revisó de nuevo el PDF adjunto, con foco en la composición 44 y las variantes de teléfono 33–40.

La composición 44 proporciona un sistema coherente oscuro. La implementación reproduce: encabezado de marca centrado; fondo carbón; 16 px de margen; tarjetas 2×2 con Operaciones, Acierto, Resultado neto y Ratio B/R; gráfico inmediatamente debajo; diario con CTA de ancho completo, lista reciente y anillo de disciplina; cinco EA en filas compactas; cinco pestañas inferiores exactas.

Solo existe un portal estrecho, de hasta 430 px. No hay disposición alternativa para PC, sidebar, hero de bienvenida o barra superior de cuentas. El cambio de cuenta vive en Ajustes.

El viewport usa safe areas y dvh; los campos tienen fuente de 16 px. No se simula la hora, señal o batería del sistema. Safari y la pantalla de inicio del iPhone gestionan esas áreas. Los formularios se presentan como hojas inferiores.

Los datos reales no se reemplazan para imitar las cifras ilustrativas del PDF. El ejemplo explícito permanece separado del diario y de la nube.

La revisión visual interactiva en navegador y las pruebas en un iPhone físico no están disponibles en este entorno. Se comprueban sintaxis, renderizado de vistas, cálculos, importación, persistencia, API y entrega de recursos.

## Readaptación 3.1

La captura proporcionada mostraba Mercados en dos columnas dentro de una pantalla estrecha. La lista de seguimiento y el gráfico se sustituyeron por un selector en hoja inferior y un gráfico de ancho completo. Los módulos secundarios usan composición móvil explícita sin depender de media queries del navegador exterior. Se corrigieron selectores de clases anteriores, plantillas de laboratorio, informes, formularios y las pestañas del EA.

Los gráficos de resultados añaden inspección de fecha/valor, ejes legibles y límites de representación para historiales grandes. El diario incorpora filtros combinados. La navegación fija queda fuera del contenedor de consultas, evitando que el contenedor cambie su referencia de posición.

## Navegación 4.0 y recorrido

La navegación principal pasa a Inicio, Diario, Análisis, Revisión y Perfil. Herramientas agrupa los conceptos de EA, el laboratorio y los mercados desde Perfil. El encabezado, cuenta activa y barra inferior permanecen en el DOM. Las animaciones se limitan a cambios de ruta, con cancelación segura ante toques rápidos y soporte de movimiento reducido personal/del sistema. La barra presenta indicador desplazable, respuesta de presión y breve animación del icono.

La revisión semanal y la disciplina conviven en una pantalla. Inicio guía la configuración de cuenta, reglas y primer historial; Análisis informa por qué faltan valores en vez de presentar un drawdown rojo de cero. Los campos de revisión sin guardar se conservan en memoria al cambiar de pantalla, separados por cuenta.

## Revisión y análisis 5.0

La revisión pasa a tres bloques progresivos y adapta sus preguntas a semanas sin operaciones. El resumen tiene evidencia y la acción anterior. Análisis incorpora filtros de contexto y acceso desde cada grupo a sus operaciones. Se mantienen cinco pestañas, contexto de cuenta y animaciones con movimiento reducido.

La tipografía secundaria se aumenta a 12–13 px y la lectura principal a 15–16 px, con controles táctiles de 44 px y campos de 16 px. La sincronización global se conserva y se retira el estado duplicado al final de Perfil.

## Acabado y movimiento 6.0

Se incorpora la apertura de marca, tres niveles de superficie carbón, bordes discretos, presión de botones, confirmaciones de guardado y transiciones diferenciadas de pestañas y detalles. Los paneles animan entrada y salida; los controles internos y desplegables usan cambios de altura cancelables. Las pruebas cubren toques rápidos, sustitución de paneles, foco de validación, movimiento reducido y cancelación de importaciones. La comprobación visual interactiva y en iPhone físico sigue pendiente; no se afirma fidelidad visual verificada.
