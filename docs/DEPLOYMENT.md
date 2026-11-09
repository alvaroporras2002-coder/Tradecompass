# Despliegue

## Sites: aplicación con nube

La configuración persistida está en `.openai/hosting.json`. Se conserva el `project_id` del sitio y se declara el binding R2 `BUCKET`. Para el Worker se omite `static`; el resultado esperado es `dist/server/index.js`, un módulo ESM con `default.fetch`.

1. Ejecuta `npm run check`, `npm test` y `npm run build`.
2. Empaqueta y sincroniza el repositorio mediante el flujo de fuentes de Sites.
3. Guarda la versión del commit enviado y publica esa versión con el mismo archivo compilado.
4. Conserva la audiencia privada existente, salvo una decisión explícita de cambiarla.
5. Comprueba el estado final de despliegue. Inicia sesión desde dos dispositivos y verifica una edición, descarga y conflicto sin pérdida de información.

Sites proporciona la identidad y conecta R2; no hay claves de usuario en el código. No implementes `/signin-with-chatgpt`, `/signout-with-chatgpt` ni `/callback`: pertenecen al alojamiento. No guardes tokens, contraseñas, `.env` ni credenciales de publicación en Git.

La integración espera `env.BUCKET` con la API de Cloudflare R2 y las cabeceras de identidad verificadas por Sites. Si falta R2, la sesión indica `cloud: false` y las operaciones de sincronización devuelven un error recuperable. Un visitante sin identidad no puede leer ni escribir el documento.

## GitHub Pages: versión local y PWA

GitHub Pages solo puede servir `dist/client/`; no ejecuta el Worker. Esta distribución permite usar el diario en el dispositivo y exportar copias, pero no ofrece sincronización entre teléfono y computadora.

El flujo `ci.yml` verifica la sintaxis, ejecuta pruebas, compila y adjunta `tradecompass-web` en cada ejecución. Para publicar mediante el mismo flujo:

1. En el repositorio abre Settings → Pages y selecciona GitHub Actions como origen.
2. Abre Actions → TradeCompass CI → Run workflow desde `main`.
3. Activa `Publicar versión estática en GitHub Pages` y ejecuta.
4. Consulta la URL del entorno `github-pages` al finalizar.

El código de la aplicación usa rutas relativas para sus recursos. Si se introduce una ruta absoluta nueva, comprueba su comportamiento en la subruta del repositorio (`/Tradecompass/`). La identidad y el backend de Sites no se trasladan a GitHub Pages.

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
