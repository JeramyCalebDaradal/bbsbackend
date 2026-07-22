#!/bin/bash
set -e

IMAGE_NAME="bbsbackend"
CONTAINER_NAME="bbsbackend"
SHA="$1"
REGISTRY_DIR="$2"
VERSION_FILE="${REGISTRY_DIR}/.deploy-versions-backend"
NETWORK_NAME="bbsnet"
ENV_FILE="/etc/bbs/backend/bbsbackend.env"

echo "=== Loading new image ==="
gunzip -c "${REGISTRY_DIR}/${IMAGE_NAME}-${SHA}.tar.gz" | docker load
rm -f "${REGISTRY_DIR}/${IMAGE_NAME}-${SHA}.tar.gz"

echo "=== Updating version manifest ==="
mkdir -p "$(dirname "${VERSION_FILE}")"
touch "${VERSION_FILE}"
{ echo "${SHA}"; cat "${VERSION_FILE}"; } \
  | awk '!seen[$0]++' \
  | head -n 3 > "${VERSION_FILE}.tmp"
mv "${VERSION_FILE}.tmp" "${VERSION_FILE}"

echo "=== Pruning old images (keep last 3) ==="
CURRENT_VERSIONS=$(cat "${VERSION_FILE}")
docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep "^${IMAGE_NAME}:" \
  | while read -r IMG; do
      TAG="${IMG#*:}"
      if [ "${TAG}" = "latest" ]; then
        continue
      fi
      if ! echo "${CURRENT_VERSIONS}" | grep -q "^${TAG}$"; then
        echo "  Removing old image: ${IMG}"
        docker rmi "${IMG}" 2>/dev/null || true
      fi
    done

echo "=== Ensuring Docker network ==="
docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1 || \
  docker network create "${NETWORK_NAME}"

echo "=== Stopping old container ==="
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

echo "=== Starting new container ==="
docker run -d \
  --name "${CONTAINER_NAME}" \
  --network "${NETWORK_NAME}" \
  --restart unless-stopped \
  --env-file "${ENV_FILE}" \
  "${IMAGE_NAME}:${SHA}"

echo "=== Deployment complete ==="
echo "Active versions:"
cat "${VERSION_FILE}"