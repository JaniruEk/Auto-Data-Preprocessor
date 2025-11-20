# CSV Auto Preprocess & Visualize (FastAPI + React)

Upload a CSV dataset, preview it, see quick stats/plots, and run an automated preprocessing pipeline (imputation, scaling, one-hot encoding). Download the processed CSV and reuse the fitted pipeline.

## Run Backend (FastAPI)

```powershell
# From project root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# Start the server (after building frontend)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```
- Open the local URL shown in the terminal (usually http://localhost:5173) for development.

### Production Build
To serve the React app with FastAPI:
```powershell
cd frontend
npm run build
```
- This outputs static files to `app/frontend/`.
- Now start the FastAPI server and visit http://localhost:8000

## API
- `POST /api/upload` (multipart `file`): returns `dataset_id` and preview
- `GET /api/preview?dataset_id=...`: CSV head preview
- `GET /api/profile?dataset_id=...`: basic stats and top correlations
- `GET /api/visual/hist?dataset_id=...&column=...&bins=20`: histogram data
- `POST /api/preprocess?dataset_id=...&scale_numeric=true`: run auto preprocessing
- `GET /api/download?dataset_id=...&type=original|processed`: download CSV

## Notes
- The React app is in `frontend/` and built output is in `app/frontend/`.
- The backend is in `app/`.
- The old static HTML/JS files are no longer used.
