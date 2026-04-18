# Importar datos locales a PostgreSQL en Render

## Contexto

- El backend en Render usa otra instancia de Postgres; al crearla viene **vacía**.
- Los datos “de verdad” estaban en **local** (Docker o backup `girona-back/girona_dev.backup`).

## Resumen del flujo

1. Tener datos en local (restaurar el `.backup` en Docker si hace falta).
2. Generar un dump en formato custom: `pg_dump -Fc` → archivo `.dump`.
3. En Render, variable **`DATABASE_URL`** ya debe apuntar a esa base.
4. **Vaciar** el esquema `public` en la base de Render y **restaurar** el `.dump` **sin** `--clean`.
5. Comprobar con `psql` (conteos) o la API en producción.

## 1. Docker local (si la base está vacía)

```bash
docker compose up -d db
./deploy/portable/restore-db.sh girona-back/girona_dev.backup
```

El backup puede venir del ZIP del proyecto si no está en el clon de Git.

## 2. Generar el archivo para subir

Desde la raíz del repo:

```bash
docker compose exec -T db pg_dump -U girona_user -d girona_prod -Fc > ./girona_para_render.dump
```

(Ajusta usuario/base si tu `.env` usa otros valores.)

## 3. Variable en Render

En el Web Service → **Environment** → `DATABASE_URL` = URL `postgresql://...` de la base de Render (con `?sslmode=require` si hace falta).

## 4. Importar desde tu PC (sin `postgresql-client` en el host)

Definir la URL **entre comillas simples**:

```bash
export DATABASE_URL_RENDER='postgresql://...'
```

**Limpiar esquema y restaurar** (evita errores de `--clean` por orden de FKs):

```bash
cd /ruta/al/repo

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL_RENDER" \
  postgres:16 \
  sh -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL_RENDER" \
  -v "$PWD:/dump:ro" \
  postgres:16 \
  sh -c 'pg_restore --verbose --no-owner --no-privileges -d "$DATABASE_URL" /dump/girona_para_render.dump'
```

Notas:

- `pg_restore ... -d "$DATABASE_URL"` debe ir dentro de `sh -c '...'` para que la URL se use **dentro** del contenedor, no vacía en el host.
- No uses `--clean` en este paso si ya hiciste `DROP SCHEMA public CASCADE`.

## 5. Comprobar

```bash
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL_RENDER" \
  postgres:16 \
  sh -c 'psql "$DATABASE_URL" -c "SELECT count(*) FROM waiters;"'
```

Luego revisar [Swagger](https://girona-deploy.onrender.com/docs) o la app contra el mismo backend.

## Ajustes hechos en el repo (referencia)

- `deploy/portable/restore-db.sh`: `docker compose exec -i -T` y redirección del backup para que `pg_restore` reciba el archivo bien.
- `.env.deploy.example` y nota en `DEPLOY_PORTABLE.md` si el `.backup` no viene en Git.
