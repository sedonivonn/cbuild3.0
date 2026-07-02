#!/usr/bin/env bash
# =============================================================================
# championsbuild - manual Cloud Run deploy helper
# =============================================================================
# Usage:
#   PROJECT_ID=my-gcp-project REGION=europe-west1 ./deploy.sh
#
# Assumes: gcloud installed & authenticated, Artifact Registry repo exists,
# billing enabled, Firestore in Native mode, and (optionally) Firebase Auth
# providers enabled in the Firebase Console (Email/Password + Google).
#
# What it does:
#   1. Enables required GCP APIs.
#   2. Creates an Artifact Registry Docker repo (idempotent).
#   3. Builds the backend image with Cloud Build and pushes it.
#   4. Deploys to Cloud Run with the right env vars.
#   5. Prints the service URL so you can plug it into the frontend
#      REACT_APP_BACKEND_URL.
# =============================================================================
set -euo pipefail

# --- Config (override via env) ---
PROJECT_ID="${PROJECT_ID:?PROJECT_ID env var is required}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-championsbuild-api}"
REPO="${REPO:-championsbuild}"
ARTIFACT_HOST="${REGION}-docker.pkg.dev"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
IMAGE="${ARTIFACT_HOST}/${PROJECT_ID}/${REPO}/${SERVICE}:${IMAGE_TAG}"
CORS_ORIGINS="${CORS_ORIGINS:-*}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-5}"
MEMORY="${MEMORY:-512Mi}"
CPU="${CPU:-1}"

# Optional: attach a dedicated runtime service account (recommended).
# Give it roles: roles/datastore.user, roles/firebaseauth.admin, and
# roles/logging.logWriter.
RUNTIME_SA="${RUNTIME_SA:-}"

echo "==> Project     : ${PROJECT_ID}"
echo "==> Region      : ${REGION}"
echo "==> Service     : ${SERVICE}"
echo "==> Image       : ${IMAGE}"

# --- 1. Enable APIs (idempotent) ---
echo "==> Enabling APIs (Run, Build, Artifact Registry, Firestore, IAM)"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    firestore.googleapis.com \
    iamcredentials.googleapis.com \
    --project="${PROJECT_ID}"

# --- 2. Artifact Registry repo ---
if ! gcloud artifacts repositories describe "${REPO}" \
        --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "==> Creating Artifact Registry repo ${REPO}"
    gcloud artifacts repositories create "${REPO}" \
        --repository-format=docker \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --description="championsbuild containers"
else
    echo "==> Artifact Registry repo ${REPO} already exists"
fi

# --- 3. Build & push via Cloud Build ---
echo "==> Submitting build to Cloud Build"
gcloud builds submit ./backend \
    --tag="${IMAGE}" \
    --project="${PROJECT_ID}"

# --- 4. Deploy to Cloud Run ---
EXTRA_ARGS=()
if [ -n "${RUNTIME_SA}" ]; then
    EXTRA_ARGS+=( --service-account="${RUNTIME_SA}" )
fi

echo "==> Deploying to Cloud Run"
gcloud run deploy "${SERVICE}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory="${MEMORY}" \
    --cpu="${CPU}" \
    --min-instances="${MIN_INSTANCES}" \
    --max-instances="${MAX_INSTANCES}" \
    --timeout=120s \
    --set-env-vars="APP_ENV=production,DB_PROVIDER=firestore,FIREBASE_ENABLED=true,FIREBASE_PROJECT_ID=${PROJECT_ID},CORS_ORIGINS=${CORS_ORIGINS}" \
    "${EXTRA_ARGS[@]}"

# --- 5. Output ---
URL=$(gcloud run services describe "${SERVICE}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format="value(status.url)")

echo ""
echo "===================================================================="
echo "  Deployed: ${URL}"
echo "  Health : ${URL}/api/health"
echo "===================================================================="
echo ""
echo "Next steps:"
echo "  1. Set frontend/.env REACT_APP_BACKEND_URL=${URL}"
echo "  2. Rebuild the frontend and (re-)deploy it."
echo "  3. Ensure Firebase Auth providers (Email/Password + Google) are ON."
