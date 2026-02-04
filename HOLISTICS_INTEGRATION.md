# Intégration Holistics.io

## Vue d'ensemble

Holistics.io est la plateforme BI utilisée par lempire pour centraliser les métriques financières (ARR, MRR, churn, etc.).

## Authentification API

- **Host** : `https://eu.holistics.io` (région Europe)
- **Header** : `X-Holistics-Key: <API_KEY>`
- **Permissions** : L'utilisateur doit avoir "Allow API access" coché dans User Management

## Endpoints utilisés

### Lister les dashboards

```bash
GET /api/v2/dashboards
```

Retourne tous les dashboards avec leurs widgets (QueryReports).

### Récupérer un dashboard

```bash
GET /api/v2/dashboards/{dashboard_id}
```

### Soumettre une requête de rapport

```bash
GET /queries/{report_id}/submit_query.json
```

Retourne un `job_id` pour polling asynchrone.

### Récupérer les résultats

```bash
GET /queries/get_query_results.json?job_id={job_id}&_page={page}
```

- `status`: "success" | "failure" | "running"
- `values`: tableau de données
- `paginated.num_pages`: nombre total de pages

## Rapports disponibles (ARR)

| Report ID | Titre | Description |
|-----------|-------|-------------|
| 2199023346927 | Breakdown Revenue by Product | ARR mensuel par produit (historique complet) |
| 2199023346923 | Current Month ARR and Monthly Growth | ARR et croissance du mois |
| 2199023379295 | Daily ARR | ARR total journalier |
| 2199023393848 | Current Month MRR Growth by Product | Croissance MRR par produit |

## Structure des données - Rapport 2199023346927

Colonnes retournées :
- `dm_pamfab_em_b2de69` : date (format YYYY-MM-01)
- `pamfab_pn_27cacf` : nom du produit
- `s_pamfab_ma_6dfdc3` : ARR mensuel ($)

Produits disponibles :
- `lemlist`
- `claap`
- `taplio`
- `tweethunter`
- `lemwarm`
- `lemcal`

## Exemple de données (Février 2026)

```json
[
  ["2026-02-01", "lemlist", "37649178.98"],
  ["2026-02-01", "claap", "2148558.35"],
  ["2026-02-01", "taplio", "3261632.52"],
  ["2026-02-01", "tweethunter", "1162042.86"],
  ["2026-02-01", "lemwarm", "1675328.94"],
  ["2026-02-01", "lemcal", "71508.14"]
]
```

## Implémentation recommandée

### Variables d'environnement

```env
HOLISTICS_API_KEY=<demander à l'équipe>
HOLISTICS_HOST=https://eu.holistics.io
HOLISTICS_REPORT_ID=2199023346927
```

### Flux de récupération des données

```
1. POST /queries/{report_id}/submit_query.json
   → Récupérer job_id

2. POLL /queries/get_query_results.json?job_id={job_id}
   → Attendre status=success (timeout ~30s)

3. PAGINATE jusqu'à la dernière page
   → Récupérer les 2 derniers mois

4. PARSER les données
   → Extraire ARR par produit pour mois courant et mois précédent
   → Calculer monthGrowth = ARR(N) - ARR(N-1)

5. RETOURNER au format Config
```

### Format de sortie attendu

```typescript
type ProductConfig = {
  arr: number;        // ARR actuel en $
  growth: number;     // Taux de croissance annuel (calculé ou fixe)
  monthGrowth: number; // Delta ARR du mois en cours
  updatedAt: number;  // Timestamp
};

type Config = {
  lemlist: ProductConfig;
  claap: ProductConfig;
  taplio: ProductConfig;
  tweethunter: ProductConfig;
};
```

## Notes importantes

1. **Cache** : Holistics met en cache les résultats. Le champ `last_cache_updated` indique la fraîcheur.

2. **Pagination** : Les résultats sont paginés (25 lignes/page par défaut). Utiliser `_page` pour naviguer.

3. **Asynchrone** : Les requêtes sont asynchrones. Il faut polling le `job_id` jusqu'à completion.

4. **Rate limiting** : `concurrent_user_jobs_limit: 5` jobs simultanés max par utilisateur.

5. **Erreurs connues** : Certains rapports peuvent échouer avec "Missing timezone info" - utiliser un rapport alternatif.
