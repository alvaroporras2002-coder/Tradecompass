# TradeCompass

Diario de trading pensado para el teléfono: registra el contexto de cada operación, comprueba tu disciplina y convierte la revisión semanal en acciones concretas. Identidad carbón y lima, interfaz adaptable y recursos vectoriales propios.

## Abrir y activar la entrega

[Abre TradeCompass](https://tradecompass-mobile-alvaro.doordash.chatgpt.site). Esta versión publicada es privada y utiliza tu sesión de ChatGPT para acceder a la sincronización.

La implementación de GitHub está en el [PR #1](https://github.com/alvaroporras2002-coder/Tradecompass/pull/1), pendiente de integrarse en `main`. Para activar la publicación desde tu repositorio:

1. Abre [Settings → Pages](https://github.com/alvaroporras2002-coder/Tradecompass/settings/pages) y selecciona **Build and deployment → Source → GitHub Actions**.
2. Abre el PR #1 y pulsa **Merge pull request → Confirm merge**.
3. Abre **Actions → TradeCompass CI** y comprueba que la ejecución de `main` termine correctamente. El entorno **github-pages** mostrará el enlace público. Cada cambio posterior en `main` volverá a comprobar y publicar la app automáticamente.

GitHub Pages ofrece el diario y la instalación PWA con datos guardados en ese navegador; no ejecuta el backend ni sincroniza dispositivos. Para usar la nube, utiliza el enlace privado anterior. Consulta [despliegue](docs/DEPLOYMENT.md) si necesitas iniciar o repetir la primera publicación.

## Usar la aplicación

1. Explora la demostración: sus datos son simulados y sus indicadores se calculan sobre el mismo historial.
2. Crea tu espacio personal desde Ajustes. Configura tu cuenta, moneda y zona horaria.
3. Registra una operación o importa un archivo compatible de MT5. Revisa la vista previa antes de confirmar.
4. Completa estrategia, emociones, notas, capturas y checklist.
5. Revisa las estadísticas y guarda una acción para la próxima semana.

La demostración y el espacio personal se identifican en la interfaz. TradeCompass registra operaciones; no envía órdenes a un broker.

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

- Diario con operaciones abiertas y cerradas, varias cuentas, búsqueda, filtros y anotaciones.
- Importación manual de archivos MT5 compatibles, comprobación previa, detección de duplicados y lotes reversibles.
- Estadísticas calculadas: resultado después de costos, acierto, expectativa, profit factor, drawdown realizado y R cuando se conoce el riesgo inicial.
- Reglas de disciplina y revisión semanal guardada.
- Exportación CSV y copia JSON para trasladar o restaurar la información.
- Experiencia PWA: puede añadirse a la pantalla de inicio desde un navegador compatible. No es un APK ni un binario de iOS.
- Sincronización real por usuario en Sites: identidad de ChatGPT y almacenamiento R2; las escrituras usan versiones para detectar conflictos entre dispositivos.

Las operaciones abiertas no cuentan como resultados realizados. No se agregan cuentas con monedas diferentes de forma implícita. Los depósitos y retiros no son ganancias de trading.

## Límites actuales

La conexión con MT5 es mediante archivos; no hay conexión continua con el terminal ni credenciales de broker. Los conceptos de robots y sus resultados de ejemplo son simulaciones: no son EAs compilados ni estrategias validadas. No hay un servicio de IA ni datos de mercado en vivo.

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
