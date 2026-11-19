# Donde Mari — Catálogo y pedidos de bebidas a domicilio

Aplicativo web estático (HTML, CSS y JavaScript sin frameworks) desplegado en **Azure Static Web Apps**.
Permite consultar el catálogo, armar un carrito y enviar el pedido por WhatsApp.

## Estructura

```
donde-mari-web/
├── index.html                  # Página única
├── css/styles.css              # Estilos responsive
├── js/app.js                   # Lógica: catálogo, filtros, carrito, pedido
├── data/productos.json         # Catálogo y configuración de la tienda
├── img/icono.svg               # Logo / ícono
├── manifest.webmanifest        # PWA (instalable)
├── sw.js                       # Service worker (caché sin conexión)
├── staticwebapp.config.json    # Rutas, encabezados de seguridad y caché en Azure
└── .github/workflows/azure-static-web-apps.yml  # CI/CD
```

## Probar en local

```bash
cd donde-mari-web
python -m http.server 8080
# abrir http://localhost:8080
```

(Se necesita un servidor porque el catálogo se carga con `fetch`; abrir el archivo con doble clic no funciona.)

## Personalizar

Editar `data/productos.json`:
- `tienda.whatsapp`: número real en formato internacional sin `+` (ej. `573001234567`).
- `costoDomicilio`, `domicilioGratisDesde`, `horario`.
- `productos`: nombre, categoría, precio, `destacado` y emoji.

## Despliegue en Azure Static Web Apps (plan Free)

1. Subir esta carpeta a un repositorio de GitHub (rama `main`).
2. En el portal de Azure: **Crear un recurso → Static Web App**.
   - Grupo de recursos: `rg-donde-mari` · Nombre: `swa-donde-mari` · Plan: **Free**.
   - Origen: **GitHub** → seleccionar repositorio y rama `main`.
   - Detalles de compilación: Preset **Custom**, App location `/`, Api location vacío, Output location vacío.
3. **Revisar y crear**. Azure agrega el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN...` al repositorio y crea un workflow propio.
   - Si Azure genera su propio archivo en `.github/workflows/`, se puede borrar el incluido aquí (o viceversa) para no tener dos despliegues; si se conserva el de este repo, renombrar el secreto en el YAML al nombre que Azure creó.
4. Esperar a que la acción de GitHub termine (pestaña **Actions**) y abrir la URL `https://<nombre>.azurestaticapps.net` que aparece en el recurso.

Cada `git push` a `main` vuelve a desplegar automáticamente; cada Pull Request crea un entorno de vista previa.

### Alternativa con Azure CLI

```bash
az login
az group create -n rg-donde-mari -l eastus2
az staticwebapp create -n swa-donde-mari -g rg-donde-mari \
  --source https://github.com/<usuario>/donde-mari-web --branch main \
  --app-location "/" --output-location "" --login-with-github
```
