# Despliegue portable de Girona SW

Esta guía sirve para levantar el proyecto completo en otro dispositivo usando Docker Compose y un backup de PostgreSQL.

## Qué copiar

- Todo el repositorio.
- El backup de base de datos: `girona-back/girona_dev.backup` (archivo **grande**, a veces no va incluido en el clon de Git; si no está, pídelo a quien distribuye el proyecto o usa un respaldo tuyo y pásale la ruta a `restore-db.sh`).

## Requisitos

- Docker Desktop instalado y corriendo.
- Git.

## Preparar el entorno

1. Copia `.env.deploy.example` a `.env` en la raíz del repositorio.
2. Ajusta al menos:
   - `POSTGRES_PASSWORD`
   - credenciales de Factus si vas a usar facturación.
3. Levanta la infraestructura:

```bash
docker compose up -d --build
```

4. Restaura la base con el backup incluido:

```bash
./deploy/portable/restore-db.sh girona-back/girona_dev.backup
```

5. Abre la app:
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:8000` (o el puerto que hayas puesto en `BACKEND_HOST_PORT` en `.env`)

Si `docker compose` falla con **address already in use** en el puerto **8000** (p. ej. `docker-proxy` de Docker Snap), define en `.env` `BACKEND_HOST_PORT=28000` y vuelve a `docker compose up -d --build`, o ejecuta `sudo systemctl restart docker` y reintenta.

## Scripts incluidos

- `deploy/portable/restore-db.sh`: restaura un backup `.backup` en el contenedor de PostgreSQL.
- `deploy/portable/backup-db.sh`: genera un nuevo backup del contenedor PostgreSQL.

Para copiar esos datos a **PostgreSQL en Render** (producción), ver `deploy/portable/IMPORTAR_DATOS_RENDER.md`.

## Flujo normal

### Primera vez

```bash
cp .env.deploy.example .env
docker compose up -d --build
./deploy/portable/restore-db.sh girona-back/girona_dev.backup
```

### Para generar un respaldo nuevo

```bash
./deploy/portable/backup-db.sh girona-back/girona_dev.backup
```