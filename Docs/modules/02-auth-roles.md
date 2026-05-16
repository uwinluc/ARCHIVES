# Module 02 — Authentification & Rôles

## Objectif

Garantir que chaque utilisateur accède uniquement aux ressources de sa filiale, avec les permissions correspondant à son rôle.

---

## Rôles

| Rôle              | Périmètre     | Description                                                    |
|-------------------|---------------|----------------------------------------------------------------|
| `SUPER_ADMIN`     | Groupe        | Accès total, configuration système, vue toutes filiales        |
| `ADMIN_FILIALE`   | Filiale       | Administration d'une filiale (users, catégories, config)       |
| `ARCHIVISTE`      | Filiale       | Gestion complète des documents (validation, archivage, destruction) |
| `MANAGER`         | Filiale       | Validation de documents, accès rapports, partages inter-filiales |
| `COLLABORATEUR`   | Filiale       | Dépôt et consultation des documents de sa filiale              |
| `LECTEUR`         | Filiale       | Consultation uniquement, pas de dépôt                          |

Un utilisateur a **un seul rôle par filiale**. Un SUPER_ADMIN n'est rattaché à aucune filiale.

---

## Matrice des permissions

| Action                        | SUPER_ADMIN | ADMIN_FILIALE | ARCHIVISTE | MANAGER | COLLABORATEUR | LECTEUR |
|-------------------------------|:-----------:|:-------------:|:----------:|:-------:|:-------------:|:-------:|
| Voir tous les documents       | ✅          | ✅ (filiale)  | ✅         | ✅      | ✅            | ✅      |
| Déposer un document           | ✅          | ✅            | ✅         | ✅      | ✅            | ❌      |
| Modifier métadonnées          | ✅          | ✅            | ✅         | ✅      | ✅ (siens)    | ❌      |
| Valider un document           | ✅          | ✅            | ✅         | ✅      | ❌            | ❌      |
| Archiver un document          | ✅          | ✅            | ✅         | ❌      | ❌            | ❌      |
| Lancer destruction            | ✅          | ✅            | ✅         | ❌      | ❌            | ❌      |
| Confirmer destruction         | ✅          | ✅            | ❌         | ❌      | ❌            | ❌      |
| Partager inter-filiales       | ✅          | ✅            | ✅         | ✅      | ❌            | ❌      |
| Gérer les utilisateurs        | ✅          | ✅ (filiale)  | ❌         | ❌      | ❌            | ❌      |
| Configurer les catégories     | ✅          | ✅ (filiale)  | ❌         | ❌      | ❌            | ❌      |
| Voir rapports filiale         | ✅          | ✅            | ✅         | ✅      | ❌            | ❌      |
| Voir rapports groupe          | ✅          | ❌            | ❌         | ❌      | ❌            | ❌      |
| Ajouter une filiale           | ✅          | ❌            | ❌         | ❌      | ❌            | ❌      |

---

## Architecture Supabase Auth

### Stockage des rôles et filiales
Les rôles et l'appartenance à une filiale sont stockés dans le champ **`app_metadata`** de l'utilisateur Supabase (côté serveur uniquement — non modifiable par le client).

```json
{
  "sub": "uuid-supabase-user",
  "email": "jean.dupont@fomi.com",
  "app_metadata": {
    "filiale_id": "uuid-filiale",
    "filiale_code": "FOMI",
    "role": "ARCHIVISTE"
  },
  "iat": 1714300000,
  "exp": 1714328800
}
```

### Mise à jour des métadonnées utilisateur
Seul le backend (via `SUPABASE_SERVICE_ROLE_KEY`) peut écrire dans `app_metadata` :

```typescript
// NestJS — UsersService
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { filiale_id, filiale_code, role }
})
```

### Vérification JWT côté NestJS
```typescript
// auth.guard.ts
const { data, error } = await supabaseAdmin.auth.getUser(bearerToken)
// getUser vérifie la signature et l'expiration automatiquement
const { filiale_id, role } = data.user.app_metadata
```

---

## Flux d'authentification (frontend React)

```
1. Utilisateur → Page login (React)
2. supabase.auth.signInWithPassword({ email, password })
3. Supabase → access_token (JWT, 1h) + refresh_token (auto-refresh)
4. Frontend → stocke en mémoire via @supabase/supabase-js (gestion automatique)
5. Chaque requête API → Authorization: Bearer <access_token>
6. NestJS AuthGuard → supabase.auth.getUser(token) → extrait app_metadata
7. RolesGuard → vérifie role
8. FilialeGuard → vérifie filiale_id
```

---

## Gestion des sessions

| Paramètre             | Valeur                                     |
|-----------------------|--------------------------------------------|
| Access token TTL      | 1 heure (configurable Supabase Dashboard)  |
| Refresh token TTL     | 7 jours (auto-refresh par le client JS)    |
| Stockage token        | Mémoire JS via `@supabase/supabase-js`     |
| Révocation possible   | Oui — `supabase.auth.admin.signOut(userId)`|

---

## Règles critiques backend (NestJS Guards)

Chaque endpoint applique dans l'ordre :
1. **AuthGuard** — `supabase.auth.getUser(token)` valide le JWT Supabase
2. **RolesGuard** — `app_metadata.role` ≥ rôle minimum requis
3. **FilialeGuard** — `app_metadata.filiale_id` == `filialeId` de la ressource (sauf SUPER_ADMIN)

Ces guards s'appuient sur `SUPABASE_JWT_SECRET` pour vérification locale (sans appel réseau) ou sur `supabase.auth.getUser()` (avec appel, plus fiable).

---

## Onboarding d'un nouvel utilisateur

1. ADMIN_FILIALE crée le compte via l'interface → appel backend `POST /users`
2. Backend crée l'utilisateur Supabase Auth via Admin API (`service_role_key`)
3. Backend définit `app_metadata` : `{ filiale_id, filiale_code, role }`
4. Supabase envoie automatiquement l'email de confirmation (configurable dans Dashboard)
5. L'utilisateur clique le lien → définit son mot de passe → compte actif

---

## Politique de mots de passe (Supabase Auth)

Configurer dans **Supabase Dashboard → Authentication → Providers → Email** :
- Longueur minimale : 12 caractères
- Confirmation email obligatoire
- Double opt-in activé

> Pour les règles de complexité avancées (majuscule + chiffre + spécial), implémenter une validation côté backend à la création/modification du mot de passe via un hook Supabase ou une validation NestJS avant d'appeler l'Admin API.

---

## Supabase Storage — accès fichiers

Les buckets Supabase Storage (`gi-fomi`, `gi-ihl`, etc.) sont privés.
L'accès aux fichiers se fait **uniquement via le backend NestJS** (service_role_key) qui génère des **presigned URLs** (durée : 15 minutes).

```typescript
const { data } = await supabaseAdmin.storage
  .from(`gi-${filialeCode}`)
  .createSignedUrl(storageKey, 900) // 900 secondes = 15 min
```

Le frontend ne connaît jamais le `storageKey` ni les credentials Supabase Storage.
