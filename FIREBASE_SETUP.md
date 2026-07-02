# championsbuild - Firebase + Cloud Run Migration Guide

This document explains how to finish wiring the app to Firebase (Auth + Firestore)
and deploy the backend to Google Cloud Run.

## 1. Create the GCP / Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Give it a name (e.g. `championsbuild`). Enable Google Analytics if you want.
3. In the Firebase console, open **Build > Authentication > Sign-in method**
   and enable:
   - **Email/Password**
   - **Google** (set the support email)
4. Open **Build > Firestore Database** and create a database in **Native**
   mode. Pick a region close to your users (e.g. `eur3` or `europe-west1`).

## 2. Get frontend Firebase config

In the Firebase console:
- **Project settings > General > Your apps > Web app** (create one if
  missing). Copy the config values into `frontend/.env`:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

Restart the frontend after editing.

## 3. Backend credentials (local dev)

Backend needs to verify Firebase ID tokens and (optionally) write to Firestore.

Option A - service account file (easiest for local dev):
1. In the Firebase console: **Project settings > Service accounts >
   Generate new private key**. Save the JSON somewhere OUTSIDE the repo, e.g.
   `~/secrets/championsbuild-sa.json`.
2. In `backend/.env` set:
   ```
   FIREBASE_ENABLED=true
   FIREBASE_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/championsbuild-sa.json
   DB_PROVIDER=firestore   # or keep 'mongo' locally and switch only in Cloud Run
   ```
3. `sudo supervisorctl restart backend`

Option B - inline JSON (useful for CI):
- Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the raw JSON string OR to its base64
  encoding. Leave `GOOGLE_APPLICATION_CREDENTIALS` empty.

Option C - Application Default Credentials (Cloud Run):
- Leave both empty and give the Cloud Run runtime service account the
  `roles/datastore.user` and `roles/firebaseauth.admin` roles.

## 4. Deploy the backend to Cloud Run

### 4.1 One-shot manual deploy

```
cd /app
chmod +x deploy.sh
PROJECT_ID=your-gcp-project REGION=europe-west1 ./deploy.sh
```

What the script does:
- Enables Cloud Run, Cloud Build, Artifact Registry, Firestore, IAM APIs.
- Creates an Artifact Registry repo `championsbuild` (idempotent).
- Submits the build using `backend/Dockerfile`.
- Deploys `championsbuild-api` to Cloud Run with `--allow-unauthenticated`.
- Sets env vars: `APP_ENV=production`, `DB_PROVIDER=firestore`,
  `FIREBASE_ENABLED=true`, `FIREBASE_PROJECT_ID`, `CORS_ORIGINS`.
- Prints the service URL.

### 4.2 Cloud Build trigger (CI/CD)

`cloudbuild.yaml` at the repo root builds + deploys on every commit.
Create a trigger:

```
gcloud builds triggers create github \
  --name=championsbuild-main \
  --repo-name=<repo> --repo-owner=<owner> \
  --branch-pattern=^main$ \
  --build-config=cloudbuild.yaml
```

## 5. After the first deploy

1. Copy the Cloud Run URL printed by the script.
2. Set it in the frontend `.env`:
   ```
   REACT_APP_BACKEND_URL=https://championsbuild-api-xxxx.a.run.app
   ```
3. Restart / redeploy the frontend.
4. Add the frontend origin to `CORS_ORIGINS` on Cloud Run:
   ```
   gcloud run services update championsbuild-api \
     --region=europe-west1 \
     --update-env-vars=CORS_ORIGINS=https://your-frontend.example.com
   ```

## 6. Dual-mode behaviour recap

| Env var          | Local dev         | Cloud Run         |
|------------------|-------------------|-------------------|
| `APP_ENV`        | `development`     | `production`      |
| `DB_PROVIDER`    | `mongo` (default) | `firestore`       |
| `FIREBASE_ENABLED` | `false` (default) or `true` when you add credentials | `true`            |
| `MONGO_URL`      | `mongodb://localhost:27017` | unused           |

The backend degrades gracefully:
- Missing Firebase credentials -> `/api/status` still works via Mongo/Firestore
  (whichever is picked). `/api/auth/*` returns 503.
- Missing Mongo -> switch `DB_PROVIDER=firestore` and Firestore takes over.

All API paths stay under `/api/*` so the frontend contract is unchanged.
