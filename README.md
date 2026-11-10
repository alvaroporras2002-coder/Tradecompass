# TradeCompass · iPhone

Portal web instalable diseñado solo para iPhone, con una columna de hasta 430 px. Su interfaz conserva la identidad Carbón y Lima y prioriza el recorrido funcional del diario: encabezado centrado y cinco pestañas, Inicio / Diario / Análisis / Revisión / Perfil. Mantiene la misma composición estrecha cuando se abre en una computadora. La cuenta activa y el estado de guardado permanecen visibles. Herramientas agrupa EA, laboratorio y mercados desde Perfil. La aplicación comienza con un diario vacío; el ejemplo es un espacio temporal separado.

## Uso

Abre https://tradecompass-49-mobile-alvaro.doordash.chatgpt.site con tu sesión de ChatGPT. Configura tu perfil y cuenta desde Explorar → Conoce TradeCompass o Cuenta → Editar perfil. En iPhone: Safari → Compartir → Añadir a pantalla de inicio. Usa las áreas seguras superiores e inferiores del dispositivo, unidades dvh y campos de 16 px para evitar el zoom de Safari al escribir.

## Funciones

- Diario: registro rápido/completo, edición, eliminación confirmada, notas, estrategia, etiquetas, emociones, checklist y capturas. Filtros combinados por texto, dirección, estrategia y estado en una hoja inferior.
- Importación MT5 mediante CSV/TSV/HTML: revisión, duplicados e historial de lotes reversibles.
- Resultados netos, acierto, expectativa, profit factor, riesgo R y drawdown; análisis por activo/estrategia, curva y calendario. Los gráficos del teléfono permiten inspeccionar la fecha y el valor al tocar o usar las flechas; las series grandes se simplifican visualmente conservando extremos y los cálculos usan el historial completo.
- Reglas de disciplina y revisión semanal con acciones guardadas.
- Varias cuentas separadas por moneda. Preferencias español/inglés, zona horaria, tema claro/oscuro y movimiento reducido.
- Mercados ilustrativos en una columna: selector de instrumento y favoritos en una hoja inferior, gráfico completo con velas/línea/barras, temporalidades, cursor táctil y niveles personales. No se utilizan cotizaciones en vivo.
- Biblioteca de los cinco conceptos EA de la guía, detalles y notas personales. Todos están en desarrollo y sin descarga ejecutable.
- Laboratorio: registra evaluaciones manuales históricas o forward demo, evidencias de archivo y exportaciones. No ejecuta backtests.
- Planes: propuesta Gratis y Pro de US$9/mes o US$90/año. Guarda interés; no realiza cargos ni activa suscripciones.
- Informes calculados, CSV, JSON completo y documento HTML para imprimir como PDF.
- Plantillas de correo y comunicaciones editables/descargables. No envía correos.
- Guía navegable con las 49 imágenes originales, categorías, búsqueda y ampliación, más tokens de identidad.
- PWA con diario sin conexión; sincronización privada por usuario en R2, control de versiones y detección de conflictos.

## Límites explícitos

Los mercados son simulados, los EA son conceptos, los pagos no están conectados y la conexión automática con un broker está pendiente. La app registra e importa operaciones; no ejecuta órdenes. El inicio de sesión se gestiona mediante ChatGPT, no mediante un proveedor de contraseñas propio. Las referencias gráficas del PDF no constituyen datos reales del usuario.

El almacenamiento local usa IndexedDB con respaldo alternativo en el navegador. La sincronización requiere internet y una sesión autenticada en el alojamiento Sites; en alojamiento estático los datos quedan en el dispositivo. El límite de documento sincronizado es 8 MiB. Exporta JSON para conservar una copia independiente. El modo Ejemplo guarda cambios solo en memoria, separados del diario personal.

## Desarrollo

Node.js 22 o posterior, sin dependencias externas. `src/views/iphone.js` contiene las cinco pantallas principales, `src/iphone.css` define la interfaz exclusiva para teléfono y `src/app.js` mantiene navegación, formularios y sincronización.

```sh
npm run check
npm test
npm run build
```

`dist/client/` contiene la PWA; `dist/server/index.js` es el Worker con API autenticada. La configuración `.openai/hosting.json` declara R2. Los archivos generados se excluyen de Git. Las fuentes Manrope/Inter/JetBrains Mono y los iconos Phosphor se distribuyen localmente; ver `public/LICENSES/`.

Consulta `docs/VISUAL-COVERAGE.md` para el inventario completo de 49 referencias. La revisión visual en navegador no está disponible en el entorno actual; se comprueban sintaxis, renderizado de vistas, dominio, importación, persistencia, API y presencia de todos los recursos.

Los módulos secundarios y sus gráficos mantienen su composición móvil aunque el navegador exterior sea ancho. El contenedor de consultas envuelve solo el contenido; la barra de navegación fija permanece fuera para conservar su anclaje al borde del teléfono.

## Navegación 4.0

El encabezado y la barra inferior permanecen montados durante los cambios de pantalla. Las transiciones usan opacidad y un desplazamiento corto; la barra incluye indicador deslizante, respuesta al toque y una animación breve del icono. La preferencia personal o del sistema para reducir movimiento desactiva estos efectos. Los cambios de datos en la misma pantalla no reproducen la transición.

Inicio guía la preparación de cuenta, reglas y primer historial. Revisión reúne la rutina semanal y la disciplina. Análisis explica los datos faltantes y muestra métricas sin información como guiones. El modo de ejemplo permanece separado de los datos personales.

## Revisión y análisis 5.0

La revisión semanal se organiza en Resumen, Observaciones y Acción. El resumen utiliza la zona horaria configurada y reúne operaciones, estrategias, disciplina, contexto pendiente y el compromiso anterior. Una semana sin operaciones permite revisar el plan. Las revisiones existentes conservan sus respuestas y se editan con el mismo modelo de datos.

Análisis permite combinar fechas de cierre, activo, dirección, estrategia, horarios de apertura, etiquetas, emociones y evaluación de reglas. Las fechas personalizadas sustituyen el periodo relativo y se indican expresamente; los horarios sin apertura documentada se tratan como desconocidos. Cada agrupación permite abrir las operaciones que la explican. Los resultados de una muestra filtrada se muestran en su moneda, sin presentarlos como el rendimiento total de la cuenta.

Se amplió la lectura de etiquetas y ayudas, conservando la interfaz de iPhone y las transiciones de la versión anterior.

## Movimiento y acabado 6.0

La apertura utiliza la brújula de marca mientras se recupera el diario local; desaparece en cuanto está disponible, sin esperar la conexión a la nube. Las pestañas usan un cambio breve y los detalles una entrada lateral con regreso inverso. Los paneles inferiores conservan el diálogo nativo y su foco hasta terminar el cierre; una apertura nueva cancela cualquier cierre anterior.

Los desplegables, los pasos de revisión y el selector de gráficos animan su cambio de altura y contenido. Los toques rápidos cancelan el movimiento anterior y la preferencia de movimiento reducido mantiene todas las acciones disponibles. El guardado indica trabajo local real y su confirmación; la sincronización de nube conserva su estado independiente.

La importación muestra lectura, revisión y preparación de la vista previa sin porcentajes inventados. Usa un Worker cuando está disponible y un respaldo compatible en el hilo principal; las siluetas aparecen solo si el procesamiento sigue pendiente. Cambiar de archivo, cuenta o pantalla invalida los resultados anteriores. El tema claro y la composición de cinco pestañas se conservan.
