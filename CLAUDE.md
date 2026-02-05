# TV Lempire - ARR Dashboard

Dashboard temps réel affichant l'ARR (Annual Recurring Revenue) par produit lempire sur une Smart TV.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Vercel** (hébergement + Edge Config pour la persistance)
- **Fonts** : Outfit (display), JetBrains Mono (labels/metrics)

## Architecture

```
src/
  app/
    page.tsx          # Dashboard TV (public) - layout 2 colonnes, tickers ARR par produit
    layout.tsx        # Layout global (dark theme)
    globals.css       # Styles dashboard (orb, vignette, animations)
    admin/
      page.tsx        # Interface admin (protégée par mot de passe) - config par produit
    api/
      config/
        route.ts      # GET/POST: config multi-produit (Holistics → Edge Config → defaults)
      holistics/
        route.ts      # GET: données ARR brutes depuis Holistics.io
  middleware.ts        # HTTP Basic Auth sur /admin
```

## Produits

4 produits suivis individuellement : **lemlist**, **Claap**, **Taplio**, **Tweet Hunter**.

Chaque produit a :
- `arr` : ARR de base ($)
- `growth` : taux de croissance annuel (décimal, ex: 0.25 = 25%)
- `monthGrowth` : croissance du mois en cours (delta absolu en $, saisi manuellement)
- `updatedAt` : timestamp de dernière mise à jour

## Dashboard (/)

Layout 2 colonnes :
- **Gauche (33%)** : 3 blocs empilés
  - lemlist : ARR ticker temps réel + croissance mois (vert/rouge)
  - Claap : idem
  - Taplio & Tweet Hunter : somme des deux, ARR ticker + croissance mois combinée
- **Droite (67%)** : 1 gros bloc
  - lempire (somme des 4) : ARR total ticker + croissance mois totale + $/day + $/sec

Chaque produit a son propre ticker temps réel (incrémenté chaque seconde).
Les sommes se calculent côté client à partir des tickers individuels.

## Admin (/admin)

Protégé par Basic Auth. 4 sections (une par produit), chacune avec 3 inputs :
- ARR de base ($)
- Taux de croissance annuel
- Croissance du mois en cours ($)

Un seul bouton "Save all" qui envoie la config complète.

## Variables d'environnement

| Variable | Description |
|---|---|
| `ADMIN_PASSWORD` | Mot de passe pour accéder à `/admin` |
| `EDGE_CONFIG` | Connection string Edge Config (créée auto par Vercel) |
| `EDGE_CONFIG_ID` | ID de l'Edge Config (format `ecfg_...`) |
| `VERCEL_API_TOKEN` | Token API Vercel (pour écrire dans Edge Config) |
| `HOLISTICS_API_KEY` | Clé API Holistics.io (optionnel) |
| `HOLISTICS_HOST` | Host Holistics (défaut: `https://eu.holistics.io`) |
| `HOLISTICS_REPORT_ID` | ID du rapport ARR breakdown (défaut: `2199023346927`) |

## Sources de données (priorité)

1. **Holistics.io** (si `HOLISTICS_API_KEY` configurée) - données ARR temps réel depuis le data warehouse
2. **Edge Config** (si configurée) - valeurs saisies manuellement via `/admin`
3. **Valeurs par défaut** - fallback hardcodé

Voir `HOLISTICS_INTEGRATION.md` pour les détails de l'API Holistics.

## Règles importantes

- **Ne JAMAIS démarrer le serveur de dev**. L'utilisateur le lance lui-même manuellement.
- **Code en anglais uniquement**. Pas de français dans le code (variables, commentaires, textes UI, placeholders).

## Dev

```bash
npm install
npx next dev --port 3333
```

## Déploiement

Push sur `main` → Vercel redéploie automatiquement.
