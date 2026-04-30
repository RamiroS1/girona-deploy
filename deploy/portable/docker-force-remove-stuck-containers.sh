#!/usr/bin/env bash
# Quita METADATOS del disco de los contenedores Girona cuando "permission denied" impide stop/rm.
# Tipico en Docker instalado como Snap (ruta distinta de /var/lib/docker).
#
# USA: desde la RAIZ del repo:
#   ./deploy/portable/docker-force-remove-stuck-containers.sh
# Luego: docker compose up -d --build

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DOCKER_ROOT=""
if docker info -f '{{.DockerRootDir}}' &>/dev/null; then
  DOCKER_ROOT="$(docker info -f '{{.DockerRootDir}}')"
else
  echo "ERROR: docker no responde. Arranca Docker o ejecuta este script igualmente con sudo conocido." >&2
  exit 1
fi

echo "==> Docker Root Dir detectado: $DOCKER_ROOT/containers"

collect_short_ids() {
  docker compose ps -aq 2>/dev/null || true
  docker ps -aq --filter name=^girona- 2>/dev/null || true
  docker ps -aq --filter name=girona-db 2>/dev/null || true
  docker ps -aq --filter name=girona-backend 2>/dev/null || true
  docker ps -aq --filter name=girona-frontend 2>/dev/null || true
}

SHORT_IDS="$(collect_short_ids | tr ' ' '\n' | grep -v '^$' | sort -u)"
if [ -z "$SHORT_IDS" ]; then
  echo "No hay contenedores Girona conocidos por compose/name. ¿Ya estaba limpio?"
  exit 0
fi

FULL_IDS=()
for sid in $SHORT_IDS; do
  f="$(docker inspect -f '{{.Id}}' "$sid" 2>/dev/null || echo "")"
  [ -z "$f" ] && continue
  FULL_IDS+=( "$f" )
done
if [ "${#FULL_IDS[@]}" -eq 0 ]; then
  echo "No pude resolver IDs completos desde docker inspect." >&2
  exit 1
fi

printf '%s\n' "==> Se borrarán carpetas bajo \$DOCKER/containers para:"
printf '    %s\n' "${FULL_IDS[@]}"
echo "==> Parando Docker (socket + servicio) — necesita sudo"
sudo systemctl stop docker.socket 2>/dev/null || true
sudo systemctl stop docker.service 2>/dev/null || true

containers_bases=(
  "${DOCKER_ROOT}/containers"
  "/var/lib/docker/containers"
  "/var/snap/docker/common/var-lib-docker/containers"
)

removed=0
for FULL in "${FULL_IDS[@]}"; do
  for BASE in "${containers_bases[@]}"; do
    if sudo test -d "$BASE/$FULL"; then
      echo "    sudo rm -rf $BASE/$FULL"
      sudo rm -rf "$BASE/$FULL"
      removed=$((removed + 1))
    fi
  done
done

if [ "$removed" -eq 0 ]; then
  echo "WARNING: No encontré carpetas bajo rutas conocidas; Snap puede usar otra estructura." >&2
  echo "   Buscar: sudo find /var/snap/docker -maxdepth 6 -path '*/containers/*' -type d 2>/dev/null | head -20" >&2
fi

echo "==> Arrancando Docker (sudo)"
sudo systemctl start docker.socket 2>/dev/null || true
sudo systemctl start docker.service
sleep 5

echo "==> Estado docker:"
docker ps -a --filter name=girona- || true

echo ""
echo "Listo. En la raiz del repo ejecuta:"
echo "  docker compose up -d --build"
