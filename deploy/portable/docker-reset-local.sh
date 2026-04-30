#!/usr/bin/env bash
# Reinicia el stack Docker de Girona, reconstruye imagenes nuevas y limpia imagenes sin usar.
#
# Por defecto NO borra volúmenes: conserva postgres_data / datos de BD.
#   Para borrar tambien volúmenes (BD en limpio):  DROP_DB_VOLUME=1 ./deploy/portable/docker-reset-local.sh
#
# Si fallaba "permission denied" al parar contenedores (Snap Docker): docker.socket+docker.service
# apagados y se borran carpetas bajo \$DOCKER/containers/<id> (ruta REAL vía docker info).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DOWN_ARGS=(down)
if [ "${DROP_DB_VOLUME:-0}" != "1" ]; then
  echo "==> Conservando volumenes de datos (Postgres NO se borra). Para borrar volúmenes: DROP_DB_VOLUME=1"
else
  echo "!!! ATENCION: se eliminarán volúmenes del proyecto (docker compose down --v)."
  DOWN_ARGS+=(--v)
fi

restart_docker_quick() {
  echo "==> Reinicio rapido del servicio docker (sudo)"
  sudo systemctl restart docker
  sleep 6
}

docker_full_stop_for_maintenance() {
  echo "==> Parando Docker del todo (socket + servicio)"
  sudo systemctl stop docker.socket 2>/dev/null || true
  sudo systemctl stop docker.service 2>/dev/null || true
}

docker_full_start_after_maintenance() {
  echo "==> Arrancando Docker"
  sudo systemctl start docker.socket 2>/dev/null || true
  sudo systemctl start docker.service
  sleep 6
}

remove_stuck_girona_container_dirs() {
  echo "==> Borrar carpetas metadata de contenedores Girona (Docker apagado; Snap suele usar otra raiz)"

  DOCKER_ROOT="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo "")"
  if [ -z "$DOCKER_ROOT" ]; then
    DOCKER_ROOT="/var/lib/docker"
  fi
  echo "    Docker Root Dir: $DOCKER_ROOT"

  SHORT_IDS=$(
    { docker compose ps -aq 2>/dev/null || true
      docker ps -aq --filter name=girona- 2>/dev/null || true
    } | tr ' ' '\n' | grep -v '^$' | sort -u
  )

  FULL_IDS=()
  for sid in $SHORT_IDS; do
    [ -z "$sid" ] && continue
    FULL="$(docker inspect -f '{{.Id}}' "$sid" 2>/dev/null || echo "")"
    [ -z "$FULL" ] || FULL_IDS+=( "$FULL" )
  done

  if [ "${#FULL_IDS[@]}" -eq 0 ]; then
    echo "WARNING: Sin IDs resueltos; prueba ./deploy/portable/docker-force-remove-stuck-containers.sh" >&2
    return 1
  fi

  printf '%s\n' "    Eliminar dirs para:" "${FULL_IDS[@]}"

  docker_full_stop_for_maintenance

  containers_bases=(
    "${DOCKER_ROOT}/containers"
    "/var/lib/docker/containers"
    "/var/snap/docker/common/var-lib-docker/containers"
  )

  for FULL in "${FULL_IDS[@]}"; do
    for BASE in "${containers_bases[@]}"; do
      if sudo test -d "$BASE/$FULL"; then
        echo "    sudo rm -rf $BASE/$FULL"
        sudo rm -rf "$BASE/$FULL"
      fi
    done
  done

  docker_full_start_after_maintenance
}

prune_unused_images_safe() {
  echo "==> Limpiando imagenes intermedias/builder (sin tocar volumenes)"
  docker builder prune -f 2>/dev/null || true
  docker image prune -f --filter dangling=true 2>/dev/null || docker image prune -f 2>/dev/null || true

  echo "==> Quitando imagenes sin contenedor asociado (stack debe estar en marcha; conserva postgres:16)"
  docker image prune -a -f 2>/dev/null || true
}

echo "==> Paso 1: reinicio Docker"
restart_docker_quick

echo "==> Paso 2: docker compose ${DOWN_ARGS[*]}"
set +e
docker compose "${DOWN_ARGS[@]}"
DC=$?
set -e

if [ "$DC" -ne 0 ]; then
  echo ""
  echo "compose down falló (codigo $DC); limpieza fuerza metadata contenedores + segundo down..."
  remove_stuck_girona_container_dirs || true
  docker compose "${DOWN_ARGS[@]}" || {
    echo "ERROR: compose down sigue fallando. Ejecuta: ./deploy/portable/docker-force-remove-stuck-containers.sh" >&2
    exit 1
  }
fi

restart_docker_if_db_port_blocked() {
  # Tras errores/en Snap, docker-proxy puede ocupar el mismo puerto host que Postgres.
  # El compose usa POSTGRES_HOST_PORT (def. 25432 en docker-compose.yml).
  if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ':25432'; then
    echo "==> Puerto 25432 (Postgres host) sigue ocupado. Reiniciando Docker (sudo)."
    sudo systemctl restart docker
    sleep 8
  fi
}

echo "==> Paso 3: revisar Postgres (host :25432)"
restart_docker_if_db_port_blocked

restart_docker_if_backend_host_port_busy() {
  # Mismo problema Snap: proxy ocupando BACKEND_HOST_PORT (defecto 8000).
  # Cargamos .env si existe para conocer BACKEND_HOST_PORT.
  BH="8000"
  if [ -f "$ROOT/.env" ]; then
    BH_LINE="$(grep -E '^[[:space:]]*BACKEND_HOST_PORT=' "$ROOT/.env" 2>/dev/null | tail -1 || true)"
    if [[ "$BH_LINE" =~ BACKEND_HOST_PORT=([0-9]+) ]]; then
      BH="${BASH_REMATCH[1]}"
    fi
  fi
  if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ":${BH}"; then
    echo "==> Puerto ${BH} (API en host, BACKEND_HOST_PORT) parece ocupado. Reiniciando Docker (sudo)."
    sudo systemctl restart docker
    sleep 8
  fi
}

restart_docker_if_backend_host_port_busy

echo "==> Paso 4: rebuild y arranque"
docker compose up -d --build

sleep 3

prune_unused_images_safe

echo "==> Estado:"
docker compose ps

echo ""
echo "Listo. Datos Postgres: conservados si no usaste DROP_DB_VOLUME=1"
echo "  http://localhost:3000 | API/docs: http://localhost:\${BACKEND_HOST_PORT:-8000}/docs"
echo "  Backup opcional: ./deploy/portable/restore-db.sh girona-back/girona_dev.backup"
