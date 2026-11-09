# TradeCompass

Diario de trading pensado para el teléfono: registra el contexto de cada operación, comprueba tu disciplina y convierte la revisión semanal en acciones concretas. Identidad carbón y lima, interfaz adaptable y recursos vectoriales propios.

## Abrir y activar la entrega

[Abre TradeCompass](https://tradecompass-mobile-alvaro.doordash.chatgpt.site). Esta versión publicada es privada y utiliza tu sesión de ChatGPT para acceder a la sincronización.

El repositorio publica automáticamente los cambios integrados en `main`. Puedes abrir la versión pública en [GitHub Pages](https://alvaroporras2002-coder.github.io/Tradecompass/).

La configuración inicial es **Settings → Pages → Source → GitHub Actions**. Después de integrar una actualización, **Actions → TradeCompass CI** comprueba y publica la aplicación. La versión con backend se publica por separado en el enlace privado anterior.

GitHub Pages ofrece el diario y la instalación PWA con datos guardados en ese navegador; no ejecuta el backend ni sincroniza dispositivos. Para usar la nube, utiliza el enlace privado anterior. Consulta [despliegue](docs/DEPLOYMENT.md) si necesitas iniciar o repetir la primera publicación.

## Usar la aplicación

La app comienza vacía: una cuenta llamada **Mi cuenta**, balance inicial **0** y ninguna operación de ejemplo. Los indicadores se calculan con tus registros.

1. En Ajustes, configura el nombre de tu cuenta, moneda, balance inicial y zona horaria.
2. Registra una operación o importa un archivo compatible de MT5. Revisa la vista previa antes de confirmar.
3. Añade notas, emociones, capturas y checklist cuando los necesites.
4. Revisa las estadísticas y guarda una acción para la próxima semana.

Al actualizar una instalación antigua, la limpieza retira los ejemplos originales que siguen sin editarse y conserva los registros añadidos o modificados por el usuario. Antes de cambiar esos datos se guarda una copia local del estado original: puedes descargarla en **Ajustes → Exportar respaldo anterior**. Se conserva la primera copia y no se sobrescribe con limpiezas posteriores. La misma protección se aplica al restaurar un JSON antiguo. Si no se puede guardar esa copia, la limpieza no continúa.

TradeCompass registra operaciones; no envía órdenes a un broker. La biblioteca de EA comienza vacía.

## Ejecutar y comprobar

Requiere Node.js 22 o posterior. No utiliza dependencias externas ni claves de API.

```bash
npm run check
npm test
npm run build
python3 -m http.server 4173 --directory dist/client
```

Abre `http://localhost:4173`. Este servidor sirve la versión local, con almacenamiento en el dispositivo. El backend autenticado se utiliza en el alojamiento Sites. No abras `index.html` mediante `file://`, porque los módulos y el service worker requieren HTTP o HTTPS.

## Funciones y alcance

- Diario vacío con registro rápido: activo, compra/venta, fecha, resultado neto y nota opcional. Los precios, lotes, emociones, checklist y capturas quedan en secciones opcionales.
- Importación manual de archivos MT5 compatibles, comprobación previa, detección de duplicados y lotes reversibles.
- Estadísticas calculadas: resultado después de costos, acierto, expectativa, profit factor, drawdown realizado y R cuando se conoce el riesgo inicial.
- Reglas de disciplina y revisión semanal guardada.
- Exportación CSV y copia JSON para trasladar o restaurar la información.
- Experiencia PWA: puede añadirse a la pantalla de inicio desde un navegador compatible. No es un APK ni un binario de iOS.
- Sincronización real por usuario en Sites: identidad de ChatGPT y almacenamiento R2; las escrituras usan versiones para detectar conflictos entre dispositivos.

Las operaciones abiertas no cuentan como resultados realizados. No se agregan cuentas con monedas diferentes de forma implícita. Los depósitos y retiros no son ganancias de trading.

## Límites actuales

La conexión con MT5 es mediante archivos; no hay conexión continua con el terminal ni credenciales de broker. La biblioteca de EA comienza vacía; no se cargan robots ni resultados hipotéticos. No hay un servicio de IA ni datos de mercado en vivo.

En GitHub Pages o en un servidor estático los datos permanecen en el navegador y no se sincronizan entre dispositivos. Borrar los datos del navegador puede eliminar la copia local: exporta una copia JSON antes de hacerlo. La sincronización de Sites exige sesión y el binding R2 configurado. Las capturas aumentan el tamaño del diario; el documento sincronizado tiene un límite de 8 MiB.

## Organización

| Ruta | Responsabilidad |
| --- | --- |
| `public/` | Documento inicial, identidad visual, manifest y recursos públicos |
| `src/` | Interfaz, vistas, dominio, importación y persistencia local |
| `server/worker.js` | API de sincronización autenticada y entrega de recursos |
| `scripts/build.mjs` | Compilación sin dependencias a estático y Worker |
| `tests/` | Pruebas del dominio, importación y API |
| `docs/` | Arquitectura y despliegue |
| `.github/workflows/ci.yml` | Verificación y publicación automática en GitHub Pages desde `main` |

Consulta [arquitectura](docs/ARCHITECTURE.md) y [despliegue](docs/DEPLOYMENT.md) para mantener o publicar el proyecto. Los archivos de `dist/` son generados y no se editan ni se guardan en Git.
