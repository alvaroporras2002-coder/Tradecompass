# TradeCompass · iPhone

Portal web instalable diseñado solo para iPhone, con una columna de hasta 430 px. Su interfaz conserva la identidad Carbón y Lima y prioriza el recorrido funcional del diario: encabezado centrado y cinco pestañas, Inicio / Diario / Análisis / Revisión / Perfil. Mantiene la misma composición estrecha cuando se abre en una computadora. La cuenta activa permanece visible; las confirmaciones aparecen al guardar. Herramientas agrupa EA, laboratorio y mercados desde Perfil. La aplicación comienza con un diario vacío; el ejemplo es un espacio temporal separado.

## Uso

Abre https://tradecompass-49-mobile-alvaro.doordash.chatgpt.site con tu sesión de ChatGPT. Configura tu perfil y cuenta desde Explorar → Conoce TradeCompass o Cuenta → Editar perfil. En iPhone: Safari → Compartir → Añadir a pantalla de inicio. Usa las áreas seguras superiores e inferiores del dispositivo, unidades dvh y campos de 16 px para evitar el zoom de Safari al escribir.

## Funciones

- Diario: registro rápido/completo, edición, eliminación confirmada, notas, estrategia, etiquetas, emociones, checklist y capturas. Filtros combinados por texto, dirección, estrategia y estado en una hoja inferior.
- Importación MT5 mediante CSV/TSV/HTML: revisión, duplicados e historial de lotes reversibles.
- Resultados netos, acierto, expectativa, profit factor, riesgo R y drawdown; análisis por activo/estrategia, curva y calendario. Los gráficos del teléfono permiten inspeccionar la fecha y el valor al tocar o usar las flechas; las series grandes se simplifican visualmente conservando extremos y los cálculos usan el historial completo.
- Reglas de disciplina y revisión semanal con acciones guardadas.
- Varias cuentas separadas por moneda. Preferencias español/inglés, zona horaria y tema claro/oscuro; movimiento adaptado a la preferencia del dispositivo.
- Mercados Kraken para BTC/USD, ETH/USD y SOL/USD: historial al abrir, velas/línea/barras, doce temporalidades, arrastre, zoom, inspección y niveles personales.
- Biblioteca de los cinco conceptos EA de la guía, detalles y notas personales. Todos están en desarrollo y sin descarga ejecutable.
- Laboratorio: registra evaluaciones manuales históricas o forward demo, evidencias de archivo y exportaciones. No ejecuta backtests.
- Planes simulados: TradeFree, TradePro (US$9/mes o US$90/año) y SuperTrade (US$19/mes o US$190/año). Selección persistida, checkout de tarjeta de prueba / Apple Pay ficticio, cambios de periodo y confirmación de bajadas. No hay cobros reales.
- Informes calculados, CSV, JSON completo y documento HTML para imprimir como PDF.
- Plantillas de correo y comunicaciones editables/descargables. No envía correos.
- Guía navegable con las 49 imágenes originales, categorías, búsqueda y ampliación, más tokens de identidad.
- PWA con diario sin conexión; sincronización privada por usuario en R2, control de versiones y detección de conflictos.

## Límites explícitos

Los EA son conceptos, los pagos son simulados y la conexión automática con un broker está pendiente. La app registra e importa operaciones; no ejecuta órdenes. El inicio de sesión se gestiona mediante ChatGPT, no mediante un proveedor de contraseñas propio. Las referencias gráficas del PDF no constituyen datos reales del usuario.

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


## Membresías de demostración 7.0

Perfil → Planes permite probar Gratis, Pro y Elite. Gratis es el valor inicial: una cuenta editable, 30 registros nuevos por mes UTC y una captura por operación. Pro permite cinco cuentas, cinco capturas, análisis completo, informes y sincronización. Elite permite quince cuentas, diez capturas, laboratorio manual y comparaciones entre cuentas de la misma moneda o dos periodos consecutivos de treinta días. Las comparaciones descargan un informe HTML para imprimir como PDF.

El checkout acepta solo 4242 4242 4242 4242, vencimiento 12/30 y CVC 123. No introduzcas tarjetas reales. El método guardado es únicamente un identificador ficticio (card/apple); nunca se persisten PAN, vencimiento ni CVC. Apple Pay se representa como un simulador explícito, sin APIs de pago, biometría ni cargos. Las bajadas se aplican de inmediato sin reembolsos ni prorrateos reales.

Los cambios de plan conservan todo el historial. Al bajar, la cuenta seleccionada tiene prioridad y las que exceden el límite quedan para consulta/exportación; no se borran capturas previas. El contador mensual se aplica a registros nuevos, también importaciones y restauraciones, y no disminuye al borrar/revertir. Un lote que exceda el límite se rechaza completo. CSV y JSON permanecen disponibles en todos los planes.

Estas son restricciones de una demostración en el cliente, no un sistema comercial de autorización. Pueden modificarse desde herramientas de desarrollo o un respaldo editado; antes de cobrar se necesitan facturación real y derechos verificados en servidor. Los límites técnicos existentes (20.000 registros y documento de nube de 8 MiB) siguen aplicando. No se han verificado las animaciones en navegador ni en iPhone físico en este entorno.


## Acceso simulado y perfil de trader 8.0

La bienvenida permite Crear cuenta o Iniciar sesión mediante Google, Apple o correo/contraseña de demostración. Los botones sociales representan una autorización ficticia; no contactan proveedores. El formulario acepta solamente la contraseña pública de prueba `Demo123!`, nunca se guarda ni se sincroniza. Hay un botón para completar los datos de prueba; usa un correo ficticio. La protección real del sitio sigue siendo la sesión de ChatGPT/Sites.

Los tres métodos abren el mismo perfil del espacio actual, no identidades reales distintas. Cerrar sesión de prueba conserva diario, cuentas, suscripción y respuestas. La sesión ficticia y el borrador de preguntas se mantienen en sessionStorage durante la sesión del navegador; nombre, perfil y descriptor de cuenta se guardan con el diario. No se guardan contraseñas, hashes de contraseñas ni tokens de proveedores.

Tras registrarse se pide nombre y experiencia; estilo y mercados (selección múltiple); objetivo, sesión y plataforma; día de revisión, idioma, zona horaria y moneda preferida. Las respuestas se eligen con radios, casillas o desplegables. Hay un resumen previo a guardar, regreso entre pasos y reanudación de preguntas incompletas. Las cuentas con operaciones y sus monedas permanecen intactas.

El inicio muestra saludo, estilo, mercados, día de revisión y tres accesos personalizados según experiencia, objetivo, plataforma y estilo. Son ayudas para documentar/revisar, sin recomendaciones de inversión. El perfil puede editarse desde Perfil → Editar mi perfil de trader. Los accesos respetan los derechos del plan elegido. El recordatorio de revisión aparece en la app, sin programar notificaciones externas.

Las rutas directas y la sincronización quedan suspendidas mientras no se complete el acceso/perfil o tras cerrar sesión de prueba. El acceso simulado no sustituye OAuth ni constituye autenticación comercial. No se ha realizado comprobación visual en navegador/iPhone físico en este entorno.


## Mercados activos y navegación 9.0

Los planes se muestran como TradeFree, TradePro y SuperTrade; los identificadores internos siguen siendo free/pro/elite para conservar selecciones y cuotas anteriores. Biblioteca y fichas de EA están reservadas a SuperTrade. Se eliminan las tres recomendaciones del inicio, la cinta global de plan/cuota, los estados locales del encabezado y el control visible de movimiento; la preferencia de accesibilidad del sistema sigue respetándose.

Mercados utiliza BTC/USD, ETH/USD y SOL/USD de Kraken. El Worker consulta el historial público y el navegador recibe nuevas operaciones mediante WebSocket v2. Las solicitudes del historial usan un proxy de origen fijo, parámetros permitidos, límites de respuesta, caché breve y tiempo máximo. Si falla la fuente, la interfaz indica reconexión/indisponibilidad y conserva los últimos datos recibidos sin generar precios ficticios. En alojamiento estático, la carga histórica requiere el backend; la transmisión pública puede aportar datos desde la conexión.

Temporalidades: 5s, 10s, 30s, 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W y 1M. Las de segundos se agrupan desde operaciones reales y ofrecen un historial corto; semanas y meses se agrupan desde velas diarias con fronteras UTC de lunes/mes calendario. No se rellenan periodos sin operaciones con precios inventados. La cuenta regresiva muestra el cierre del intervalo elegido; la dirección usa el resultado abierto/cerrado de esa vela, no una señal de inversión.

El gráfico admite arrastre, zoom por pellizco/rueda/botones, desplazamiento con teclado, regreso a Ahora, inspección de OHLC y niveles personales. La sesión de mercado se cancela al abandonar la pantalla o cerrar acceso y se pausa cuando se oculta la pestaña. Las divisas/CFD de las referencias anteriores no se presentan como cotizaciones en vivo: necesitan una fuente de datos compatible.

Documentación de la fuente: https://docs.kraken.com/api-reference/market-data/get-ohlc-data y https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade . El acceso externo real no pudo verificarse desde este entorno restringido; las pruebas usan respuestas y operaciones controladas. La revisión visual en navegador/iPhone físico sigue pendiente.


## Historial al abrir Mercados 9.1

Mercados abre en «Máx · semanal»: solicita hasta 720 velas semanales nativas de Kraken y muestra la fecha de la primera vela realmente devuelta. Conserva los timestamps de la fuente y su anclaje semanal al actualizar con operaciones en directo. Esta vista no promete datos desde la creación de la moneda ni anteriores a su listado en Kraken. Los intervalos cortos siguen mostrando el historial reciente disponible, no años reconstruidos artificialmente.

Se corrige el caso en que el historial REST fallaba y las operaciones WebSocket dejaban el gráfico con una sola vela. Las cotizaciones públicas no necesitan la identidad del diario; los datos personales conservan autorización. El cliente reintenta el historial aunque la transmisión esté conectada y utiliza una segunda ruta pública fija a Kraken si falla el proxy. El estado distingue entre precio en directo e historial pendiente. No se presenta el pequeño snapshot de operaciones como archivo histórico.

La caché histórica se guarda en IndexedDB separado (hasta 36 entradas), sin ocupar el respaldo localStorage del diario. Al volver, muestra datos recibidos previamente mientras se actualiza. Si ambas rutas fallan, se informa y se reintenta; no se inventan velas. Se muestran las fechas cubiertas y el número de velas. La verificación de conectividad externa real y la revisión visual en iPhone siguen sujetas a las restricciones del entorno.


## Acabado visual 10.0

El cambio de tema revela el color desde el botón con una onda circular cuando el navegador admite View Transitions; usa una entrada breve compatible en los demás. La iluminación ambiental se desplaza lentamente, con carbón y verde en oscuro y salvia tenue en claro. El encabezado conserva su espacio y adquiere cristal al desplazarse. Las tarjetas entran en secuencia solo al cambiar de sección y los botones responden con profundidad.

La barra inferior estira su indicador entre pestañas; los iconos de diario, análisis y revisión se trazan al activarse. La brújula y el nombre aparecen una sola vez al recuperar el diario, sin retrasar su apertura. Los checks y bordes elegidos confirman las selecciones. Las métricas comparan valores anteriores con los finales y deslizan únicamente sus cifras cambiadas; no fabrican resultados ni animan las cotizaciones del mercado.

Los planes comparten una transición entre la tarjeta y el checkout; la confirmación regresa a la tarjeta activa con un destello. Las capturas se amplían desde su miniatura y regresan al volver o cerrar. El diálogo nativo conserva el foco durante el regreso, y una nueva ventana o navegación invalida los cierres pendientes. Se conservan solo rectángulos de origen, sin clonar formularios ni datos de pago. Todas las acciones siguen disponibles con movimiento reducido del dispositivo y sin APIs de animación compatibles.
