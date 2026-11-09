# Arquitectura

TradeCompass utiliza módulos JavaScript estándar y CSS adaptable. No necesita un framework, CDN, gestor de paquetes de producción ni una clave de API. Los gráficos y los indicadores parten de los registros del diario; los datos de ejemplo siguen el mismo modelo que los personales.

## Capas

| Capa | Función |
| --- | --- |
| Interfaz | Navegación, formularios, filtros, mensajes y gráficos |
| Dominio | Resultado neto, estadísticas, validaciones y cumplimiento |
| Importación | Interpretación, clasificación, duplicados y lotes MT5 |
| Persistencia local | Estado del dispositivo y copias exportables |
| API Sites | Lectura y escritura aisladas por identidad autenticada |
| R2 | Un documento versionado por usuario, incluidas sus capturas |

El modelo de estado versión 1 contiene `mode`, `accounts`, `trades`, `rules`, `reviews`, `imports`, `cashflows` y `settings`. Los importes conservan la moneda de su cuenta. Los costos pagados se registran en negativo; el resultado neto suma resultado bruto, comisión y swap.

El riesgo inicial sirve para calcular R cuando está documentado. La tasa de acierto considera operaciones cerradas positivas; las cerradas sin resultado cuentan en el denominador. El drawdown realizado se calcula sobre el balance cerrado y los movimientos de efectivo se distinguen de la operativa.

## Sincronización

La identidad procede exclusivamente del gateway Sites: `oai-authenticated-user-id`. El backend calcula SHA-256 de ese identificador para elegir el objeto R2. Un `userId` enviado en JSON no influye en la autorización. La sesión devuelve el hash estable como `user.id` para asociar la copia del navegador a su propietario; nombre y correo se usan para mostrar la sesión. El identificador original no se envía al navegador.

| Operación | Contrato |
| --- | --- |
| `GET /api/session` | `{ authenticated, user: { id, name, email } \| null, cloud }` |
| `GET /api/state` | `{ state: State \| null, etag: string \| null }` |
| `PUT /api/state` | Cuerpo State v1; primera escritura con `If-None-Match: *`, actualización con `If-Match: etag` |
| `DELETE /api/state` | Misma precondición de versión; devuelve estado nulo y nueva versión |

PUT y DELETE comprueban `Origin` antes de actuar. Las precondiciones se pasan a `R2.put(..., { onlyIf })`, por lo que un dispositivo con una versión antigua recibe HTTP 409. El cliente debe conservar su copia y pedir resolver el conflicto; no debe sobrescribir silenciosamente ni reintentar con una versión nueva sin revisión. HTTP 428 indica falta de precondición. El contenido se valida en el servidor y tiene un límite de 8 MiB.

La eliminación sustituye atómicamente el contenido por una marca mínima `{ deleted: true, version: 1 }`. Así desaparecen las operaciones, cuentas y capturas guardadas en ese objeto; se conserva únicamente la marca y su ETag para impedir que un dispositivo antiguo restaure información por accidente. El cliente conserva la ETag devuelta si después crea un diario nuevo.

La API responde `Cache-Control: no-store`. El service worker debe ignorar `/api/` y nunca guardar respuestas de sesión ni documentos de usuario en la caché de recursos. La copia local y el documento remoto son mecanismos distintos: eliminar uno no debe presentarse como eliminación del otro.

## Entorno y límites

El Worker confía en que Sites valida e inyecta las cabeceras de identidad. No se debe colocar este Worker detrás de un proxy que permita al visitante falsificarlas. Otro proveedor necesitaría una implementación de autenticación verificada antes de habilitar la nube.

No hay sincronización de broker, cotizaciones, envío de órdenes, ejecución de robots ni IA de terceros. Las pantallas de exploración deben identificar los datos conceptuales o simulados. El almacenamiento por documento simplifica el uso personal; una futura colaboración o historial masivo justificaría migrar a registros separados y adjuntos R2 individuales.

## Compilación y comprobación

`npm run build` copia `public/` y `src/` a `dist/client/`. También incorpora esos archivos como un mapa de recursos en `dist/server/index.js`, junto con el Worker. Esto produce una distribución estática para GitHub Pages y una distribución autenticada para Sites sin exponer el código de servidor en la versión estática.

`npm run check` revisa la sintaxis de los módulos. `npm test` ejecuta las pruebas de dominio/importación y del backend, incluida autorización, aislamiento, validación y concurrencia. Las pruebas no certifican por sí solas accesibilidad o comportamiento en teléfonos reales; antes de un lanzamiento amplio se debe completar una revisión de interacción con dispositivos representativos.
