# CV-UCV-Exeption
WebSite for generate Exeption rules

## Run locally

```
npm install
npm run dev
```

Open http://localhost:5173. The API (Express, port 3001) keeps all data in memory, so it resets on restart.

## Export to Excel

With the app running:

```
py -m pip install -r scripts/requirements.txt
py scripts/export_to_excel.py [--output rules.xlsx] [--url http://localhost:3001]
```
