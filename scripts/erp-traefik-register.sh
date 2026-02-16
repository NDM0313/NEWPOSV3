#!/bin/bash
# Register ERP container (din-erp-production) with Traefik v3 at erp.dincouture.pk
# Run on VPS as root: bash erp-traefik-register.sh
# Safe: only redeploys ERP service; does not restart Traefik or expose new ports.

set -e

ERP_CONTAINER="${ERP_CONTAINER:-din-erp-production}"
ERP_PORT="${ERP_PORT:-3000}"   # Container internal port (use 80 if nginx serves on 80)
DOMAIN="erp.dincouture.pk"
NETWORK="dokploy-network"
OVERRIDE_FILE="docker-compose.traefik-override.yml"

echo "=== 1. Identify ERP container ==="
# Support exact name or Swarm-style name (e.g. din-erp-production.1.xxx)
ERP_CONTAINER_ACTUAL=$(docker ps -a --format '{{.Names}}' | grep -E "^${ERP_CONTAINER}$|^${ERP_CONTAINER}\." | head -1)
if [ -z "$ERP_CONTAINER_ACTUAL" ]; then
  echo "Container '${ERP_CONTAINER}' not found. Listing containers with 'erp' or 'din':"
  docker ps -a --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" | grep -iE "erp|din" || true
  echo "Set ERP_CONTAINER=your_container_name and re-run, or create the ERP deployment first."
  exit 1
fi
ERP_CONTAINER="$ERP_CONTAINER_ACTUAL"
echo "Found container: ${ERP_CONTAINER}"

# Do not attach Traefik to DB/cache services
CONTAINER_IMAGE=$(docker inspect "${ERP_CONTAINER}" --format '{{.Config.Image}}' 2>/dev/null || true)
if echo "$CONTAINER_IMAGE" | grep -qE '^postgres|^redis|/postgres|/redis'; then
  echo "ERROR: This container is a database/cache (${CONTAINER_IMAGE}), not the ERP frontend."
  echo "Add Traefik labels only to the service that serves the web app (e.g. nginx on port 80)."
  echo "See docs/ERP_502_FINDING_AND_NEXT_STEPS.md"
  exit 1
fi

echo ""
echo "=== 2. Get compose project path and service name ==="
COMPOSE_PROJECT=$(docker inspect "${ERP_CONTAINER}" --format '{{ index .Config.Labels "com.docker.compose.project" }}')
COMPOSE_SERVICE=$(docker inspect "${ERP_CONTAINER}" --format '{{ index .Config.Labels "com.docker.compose.service" }}')
WORKING_DIR=$(docker inspect "${ERP_CONTAINER}" --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')

if [ -z "$COMPOSE_SERVICE" ]; then
  # Docker Swarm: container name is like din-erp-production.1.xxx — service name is the first part
  SWARM_SERVICE=$(echo "$ERP_CONTAINER" | sed 's/\.[0-9]*\.[a-z0-9]*$//')
  if [ -n "$SWARM_SERVICE" ] && docker service ls -q --filter "name=${SWARM_SERVICE}" 2>/dev/null | grep -q .; then
    echo "Detected Swarm service: ${SWARM_SERVICE}. Adding Traefik labels via docker service update."
    if ! docker network inspect "$NETWORK" &>/dev/null; then
      docker network create "$NETWORK"
    fi
    docker service update --detach \
      --label-add "traefik.enable=true" \
      --label-add "traefik.http.routers.erp.rule=Host(\`${DOMAIN}\`)" \
      --label-add "traefik.http.routers.erp.entrypoints=websecure" \
      --label-add "traefik.http.routers.erp.tls.certresolver=letsencrypt" \
      --label-add "traefik.http.services.erp.loadbalancer.server.port=${ERP_PORT}" \
      "$SWARM_SERVICE"
    echo "Service update sent. Waiting 10s for Traefik to pick up..."
    sleep 10
    echo "Running: curl -sI https://${DOMAIN}"
    curl -sI --max-time 10 "https://${DOMAIN}" 2>/dev/null | head -5 || true
    echo "Done. Verify with: curl -I https://${DOMAIN}"
    exit 0
  fi
  echo "Could not get compose service name. Container may not have been started with compose."
  echo "You need to add Traefik labels manually via Dokploy UI or compose file."
  exit 1
fi

echo "Project: ${COMPOSE_PROJECT:-<none>}, Service: ${COMPOSE_SERVICE}, Working dir: ${WORKING_DIR:-<none>}"

# Resolve compose directory
COMPOSE_DIR=""
if [ -n "$WORKING_DIR" ] && [ -d "$WORKING_DIR" ]; then
  COMPOSE_DIR="$WORKING_DIR"
elif [ -n "$WORKING_DIR" ]; then
  echo "Working dir from label not found: $WORKING_DIR"
fi

if [ -z "$COMPOSE_DIR" ]; then
  # Try common Dokploy paths
  for base in /root/dokploy /opt/dokploy /var/lib/dokploy /data/dokploy; do
    if [ -d "$base" ]; then
      FOUND=$(find "$base" -name "docker-compose.yml" -path "*${COMPOSE_PROJECT}*" 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        COMPOSE_DIR=$(dirname "$FOUND")
        break
      fi
      # By container name pattern (e.g. din-erp-production -> din-erp or din_erp)
      FOUND=$(find "$base" -name "docker-compose.yml" 2>/dev/null | xargs grep -l "din-erp\|din_erp\|${ERP_CONTAINER}" 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        COMPOSE_DIR=$(dirname "$FOUND")
        break
      fi
    fi
  done
fi

if [ -z "$COMPOSE_DIR" ] || [ ! -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
  echo "Could not find compose file for ${ERP_CONTAINER}."
  echo "Create override manually. Content to add to your ERP service (labels + network):"
  echo ""
  cat << 'YAML'
labels:
  - traefik.enable=true
  - traefik.http.routers.erp.rule=Host(`erp.dincouture.pk`)
  - traefik.http.routers.erp.entrypoints=websecure
  - traefik.http.routers.erp.tls.certresolver=letsencrypt
  - traefik.http.services.erp.loadbalancer.server.port=3000
networks:
  - dokploy-network
YAML
  echo ""
  echo "Then: docker compose up -d <service_name>"
  exit 1
fi

echo "Compose directory: ${COMPOSE_DIR}"
cd "$COMPOSE_DIR"

# Ensure external network exists
if ! docker network inspect "$NETWORK" &>/dev/null; then
  echo "Creating external network: ${NETWORK}"
  docker network create "$NETWORK"
fi

echo ""
echo "=== 3. Create Traefik override (labels + network) ==="
cat > "$OVERRIDE_FILE" << EOF
# Generated by erp-traefik-register.sh - Traefik v3 labels for ${DOMAIN}
services:
  ${COMPOSE_SERVICE}:
    labels:
      - traefik.enable=true
      - traefik.http.routers.erp.rule=Host(\`${DOMAIN}\`)
      - traefik.http.routers.erp.entrypoints=websecure
      - traefik.http.routers.erp.tls.certresolver=letsencrypt
      - traefik.http.services.erp.loadbalancer.server.port=${ERP_PORT}
    networks:
      - ${NETWORK}

networks:
  ${NETWORK}:
    external: true
EOF
echo "Wrote ${COMPOSE_DIR}/${OVERRIDE_FILE}"

echo ""
echo "=== 4. Redeploy only ERP service (no Traefik restart) ==="
docker compose -f docker-compose.yml -f "$OVERRIDE_FILE" up -d "$COMPOSE_SERVICE"

echo ""
echo "=== 5. Verify (wait a few seconds for Traefik to pick up) ==="
sleep 5
echo "Running: curl -sI https://${DOMAIN}"
if curl -sI --max-time 10 "https://${DOMAIN}" 2>/dev/null | head -1 | grep -q "200"; then
  echo "OK: Got HTTP/2 200 (or 200)."
else
  echo "Response:"
  curl -sI --max-time 10 "https://${DOMAIN}" 2>/dev/null | head -5 || true
  echo "If 404 or certificate error: wait 1–2 min for Traefik/Let's Encrypt, then run: curl -I https://${DOMAIN}"
fi

echo ""
echo "Done. Only ${COMPOSE_SERVICE} was redeployed. Traefik was not restarted."
