# Despliegue

## Sites: aplicación con nube

[Aplicación publicada](https://tradecompass-49-mobile-alvaro.doordash.chatgpt.site): acceso privado mediante la sesión de ChatGPT. Este alojamiento incluye el backend; la copia de GitHub Pages funciona con almacenamiento local.

La configuración persistida está en `.openai/hosting.json`. Se conserva el `project_id` del sitio y se declara el binding R2 `BUCKET`. Para el Worker se omite `static`; el resultado esperado es `dist/server/index.js`, un módulo ESM con `default.fetch`.

1. Ejecuta `npm run check`, `npm test` y `npm run build`.
2. Empaqueta y sincroniza el repositorio mediante el flujo de fuentes de Sites.
3. Guarda la versión del commit enviado y publica esa versión con el mismo archivo compilado.
4. Conserva la audiencia privada existente, salvo una decisión explícita de cambiarla.
5. Comprueba el estado final de despliegue. Inicia sesión desde dos dispositivos y verifica una edición, descarga y conflicto sin pérdida de información.

Sites proporciona la identidad y conecta R2; no hay claves de usuario en el código. No implementes `/signin-with-chatgpt`, `/signout-with-chatgpt` ni `/callback`: pertenecen al alojamiento. No guardes tokens, contraseñas, `.env` ni credenciales de publicación en Git.

La integración espera `env.BUCKET` con la API de Cloudflare R2 y las cabeceras de identidad verificadas por Sites. Si falta R2, la sesión indica `cloud: false` y las operaciones de sincronización devuelven un error recuperable. Un visitante sin identidad no puede leer ni escribir el documento.

## GitHub Pages: activar desde el repositorio

La entrega está en el [PR #1](https://github.com/alvaroporras2002-coder/Tradecompass/pull/1), pendiente de integrarse en `main`. Sigue este orden:

1. Abre [Settings → Pages](https://github.com/alvaroporras2002-coder/Tradecompass/settings/pages) y selecciona **Build and deployment → Source → GitHub Actions**. Esta configuración se realiza una sola vez.
2. Abre el PR #1 y pulsa **Merge pull request → Confirm merge**.
3. En **Actions → TradeCompass CI**, abre la ejecución de `main`. El flujo comprueba sintaxis y pruebas, compila y publica `dist/client/`. Cuando finalice correctamente, el entorno **github-pages** mostrará la dirección de la app.
4. Si la primera ejecución terminó antes de habilitar Pages, usa **Actions → TradeCompass CI → Run workflow**, selecciona `main`, activa **Publicar versión estática en GitHub Pages** y ejecuta de nuevo.

Después de la integración, cada cambio enviado a `main` publica automáticamente una versión si las comprobaciones pasan. Las ramas de trabajo y los PR ejecutan las comprobaciones sin reemplazar la versión publicada. El artefacto `tradecompass-web` conserva el contenido estático de cada ejecución.

GitHub Pages sirve la PWA y permite registrar, importar, analizar y exportar datos en ese navegador. No ejecuta `server/worker.js`, no incluye autenticación de Sites y no ofrece sincronización entre teléfono y computadora. En esta distribución, exporta JSON para trasladar o respaldar tus registros.

El código utiliza rutas relativas para funcionar en `/Tradecompass/`. Si se introduce una ruta absoluta, comprueba que respete esa subruta. No confundas el enlace de GitHub Pages con la [versión privada con nube](https://tradecompass-49-mobile-alvaro.doordash.chatgpt.site).

## Desarrollo local

```bash
npm run check
npm test
npm run build
python3 -m http.server 4173 --directory dist/client
```

La versión local mantiene la información en ese navegador. Un cambio de origen, puerto o perfil crea un espacio local diferente. Para mover registros utiliza la copia JSON o la sincronización del sitio autenticado.

## Actualizaciones

Edita el código fuente, ejecuta comprobaciones y vuelve a compilar. No edites `dist/` manualmente. Versiona los cambios de formato y conserva validación de copias antiguas si cambia el modelo. Si se cambia el conjunto de recursos de la PWA, actualiza la versión de su caché y conserva la exclusión de la API.

La publicación de una versión nueva no debe borrar datos R2 ni reiniciar el diario local. Para revertir una versión usa una compilación anterior compatible con el modelo de estado actual.
