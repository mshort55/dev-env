#!/usr/bin/env bash
# Build the dev container image from .env.example. Does not start a container.
# Usage: build-image.sh /tmp/dev-env-verify-<run-id>/state.env
set -euo pipefail

STATE=${1:?usage: build-image.sh STATE}

set -a
# shellcheck disable=SC1090
. "$STATE"
set +a

ENV_EXAMPLE="$DEV_ENV_REPO/.env.example"
DOCKERFILE="$DEV_ENV_REPO/.devcontainer/dev/Dockerfile"
OUT="$EVIDENCE_DIR/container-image"
mkdir -p "$OUT"

TAG="dev-env:verify-${RUN_ID}"
case "$TAG" in
  dev-env:verify-*) ;;
  *)
    echo "build-image: refusing tag $TAG" >&2
    exit 1
    ;;
esac

if command -v podman >/dev/null 2>&1; then
  ENGINE=podman
elif command -v docker >/dev/null 2>&1; then
  ENGINE=docker
else
  echo "build-image: podman or docker is required" >&2
  exit 1
fi

printf '%s\n' "$TAG" > "$SCRATCH/image-tag"
printf '%s\n' "$ENGINE" > "$SCRATCH/image-engine"

BUILD_ARG_NAMES=(
  ATUIN_VERSION
  BUF_VERSION
  CONTAINER_UID
  CONTAINER_USER
  GINKGO_VERSION
  GO_VERSION
  GOPLS_VERSION
  GRPCURL_VERSION
  HCP_VERSION
  JQ_VERSION
  KIND_VERSION
  KUSTOMIZE_VERSION
  NODE_VERSION
  OPENSHIFT_VERSION
  PODMAN_VERSION
  RUST_VERSION
  UV_VERSION
  WORKSPACE_DIR_NAME
  YQ_VERSION
  ZELLIJ_VERSION
)

build_args=()
: > "$OUT/build-args.txt"
for key in "${BUILD_ARG_NAMES[@]}"; do
  line=$(grep -E "^${key}=" "$ENV_EXAMPLE" | head -n 1 || true)
  if [ -z "$line" ]; then
    echo "build-image: $key is missing from .env.example" >&2
    exit 1
  fi
  value=${line#*=}
  case "$value" in
    *'$'*|*'${'*)
      echo "build-image: $key in .env.example is interpolated" >&2
      exit 1
      ;;
  esac
  build_args+=(--build-arg "${key}=${value}")
  printf '%s=%s\n' "$key" "$value" >> "$OUT/build-args.txt"
done

{
  echo "engine=$ENGINE"
  echo "tag=$TAG"
  echo "env_file=.env.example"
  echo "dockerfile=.devcontainer/dev/Dockerfile"
  echo "container_started=no"
} > "$OUT/build.env"

set +e
"$ENGINE" build \
  --file "$DOCKERFILE" \
  --tag "$TAG" \
  "${build_args[@]}" \
  "$DEV_ENV_REPO" \
  >"$OUT/build.log" 2>&1
status=$?
set -e
echo "$status" > "$OUT/build.exit"
if [ "$status" -ne 0 ]; then
  echo "build-image: $ENGINE build failed; log is $OUT/build.log" >&2
  exit "$status"
fi

"$ENGINE" image inspect --format '{{.Id}}' "$TAG" > "$OUT/image-id.txt"
"$ENGINE" rmi "$TAG" >"$OUT/rmi.out" 2>"$OUT/rmi.err"
rm -f "$SCRATCH/image-tag" "$SCRATCH/image-engine"

cat > "$OUT/side-effects.txt" <<EOF
engine=$ENGINE
tag=$TAG
image_removed=yes
container_started=no
env_file=.env.example
latest_tag_used=no
build_exit=0
EOF

printf 'built feature=container-image evidence=%s\n' "$OUT"
