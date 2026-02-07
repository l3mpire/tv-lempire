# Chat Feature - TODO

## Décisions

- **Session** : cookie simple avec user ID (pas de JWT)
- **Login** : on remplace le login existant par signup/signin user. Le premier signup devient admin.
- **Chat** : affiché en overlay sur le dashboard TV (/), pas de route `/chat` séparée

## 1. Auth (signup/signin)

- [x] Créer table `users` (id uuid, email, name, password_hash, created_at)
- [x] Installer `bcryptjs` pour le hash des passwords
- [x] API `POST /api/auth/signup` — validation, hash bcrypt, insert en DB
- [x] API `POST /api/auth/signin` — vérif email + password, set session cookie avec user ID
- [x] Adapter le proxy pour reconnaître les sessions user (pas juste `authenticated`)
- [x] Page `/signup`
- [x] Adapter page `/login` existante pour signin par email/password

## 2. Chat

- [x] Créer table `messages` (id uuid, user_id FK, content, created_at)
- [x] API `GET /api/messages` — liste des messages récents (avec nom du user)
- [x] API `POST /api/messages` — envoyer un message (auth requise)
- [x] Overlay chat sur le dashboard TV (/) — affiche les derniers messages
- [x] Supabase Realtime pour les messages en temps réel

## 3. Setup Supabase

- [x] Créer tables `users` + `messages` dans le SQL Editor Supabase
- [x] Ajouter `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans .env.local
- [x] RLS policy SELECT sur `messages` pour la clé anon
- [x] Activer Realtime sur la table `messages`
- [x] RLS policy SELECT sur `users` pour la clé anon (nécessaire pour résoudre les noms via Realtime)
