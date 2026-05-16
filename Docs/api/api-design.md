# Design API REST — GROUPE GI Archives

> Base URL : `/api/v1`
> Authentification : `Authorization: Bearer <JWT Keycloak>` sur tous les endpoints.
> Format : JSON. Pagination : `?page=1&limit=20`.

---

## Conventions

- **Succès** : `200 OK`, `201 Created`, `204 No Content`
- **Erreurs client** : `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`
- **Erreurs serveur** : `500 Internal Server Error`
- Toutes les réponses d'erreur : `{ "statusCode": 403, "error": "Forbidden", "message": "..." }`
- Les IDs sont des UUID v4.
- Les dates sont en ISO 8601 UTC (`2026-04-28T10:30:00Z`).

---

## Auth (`/auth`)

| Méthode | Route               | Description                         | Rôle requis |
|---------|---------------------|-------------------------------------|-------------|
| GET     | `/auth/me`          | Profil de l'utilisateur connecté    | Tout        |
| POST    | `/auth/logout`      | Invalide le token côté serveur      | Tout        |
| GET     | `/auth/keycloak`    | Redirect vers Keycloak (PKCE init)  | Public      |
| GET     | `/auth/callback`    | Callback Keycloak (échange code)    | Public      |

---

## Filiales (`/filiales`)

| Méthode | Route              | Description                          | Rôle requis    |
|---------|--------------------|--------------------------------------|----------------|
| GET     | `/filiales`        | Liste toutes les filiales            | SUPER_ADMIN    |
| POST    | `/filiales`        | Crée une filiale                     | SUPER_ADMIN    |
| GET     | `/filiales/:id`    | Détail d'une filiale                 | SUPER_ADMIN    |
| PATCH   | `/filiales/:id`    | Met à jour une filiale               | SUPER_ADMIN    |
| DELETE  | `/filiales/:id`    | Désactive une filiale (soft delete)  | SUPER_ADMIN    |

### POST `/filiales` — Body
```json
{
  "code": "NEWCO",
  "nom": "Nouvelle Société",
  "pays": "Congo (RDC)"
}
```

---

## Utilisateurs (`/users`)

| Méthode | Route               | Description                          | Rôle requis              |
|---------|---------------------|--------------------------------------|--------------------------|
| GET     | `/users`            | Liste les users (filiale courante)   | ADMIN_FILIALE+           |
| POST    | `/users`            | Crée un utilisateur                  | ADMIN_FILIALE+           |
| GET     | `/users/:id`        | Détail d'un utilisateur              | ADMIN_FILIALE+           |
| PATCH   | `/users/:id`        | Met à jour (rôle, actif)             | ADMIN_FILIALE+           |
| DELETE  | `/users/:id`        | Désactive un utilisateur             | ADMIN_FILIALE+           |

### POST `/users` — Body
```json
{
  "email": "jean.dupont@fomi.com",
  "prenom": "Jean",
  "nom": "Dupont",
  "filialeId": "uuid-filiale",
  "role": "COLLABORATEUR"
}
```

---

## Catégories (`/categories`)

| Méthode | Route               | Description                          | Rôle requis    |
|---------|---------------------|--------------------------------------|----------------|
| GET     | `/categories`       | Liste les catégories (filiale)       | Tout           |
| POST    | `/categories`       | Crée une catégorie                   | ADMIN_FILIALE+ |
| PATCH   | `/categories/:id`   | Met à jour une catégorie             | ADMIN_FILIALE+ |
| DELETE  | `/categories/:id`   | Désactive une catégorie              | ADMIN_FILIALE+ |

---

## Documents (`/documents`)

### Liste et recherche

| Méthode | Route               | Description                          | Rôle requis |
|---------|---------------------|--------------------------------------|-------------|
| GET     | `/documents`        | Liste paginée avec filtres           | Tout        |
| GET     | `/documents/search` | Recherche full-text (Meilisearch)    | Tout        |
| GET     | `/documents/:id`    | Détail d'un document                 | Tout        |

**GET `/documents` — Query params :**
```
?page=1&limit=20
&statut=VALIDE,ARCHIVE
&categorieId=uuid
&confidentialite=INTERNE,PUBLIC
&auteurId=uuid
&dateDocumentFrom=2026-01-01
&dateDocumentTo=2026-12-31
&tags=contrat,fournisseur
&sortBy=dateDocument&sortOrder=desc
```

**GET `/documents/search` — Query params :**
```
?q=contrat+cadre+2026
&page=1&limit=20
&[mêmes filtres que /documents]
```

### CRUD

| Méthode | Route                          | Description                         | Rôle requis           |
|---------|--------------------------------|-------------------------------------|-----------------------|
| POST    | `/documents`                   | Crée un document (métadonnées)      | COLLABORATEUR+        |
| PATCH   | `/documents/:id`               | Met à jour les métadonnées          | Auteur / ARCHIVISTE+  |
| DELETE  | `/documents/:id`               | Supprime un brouillon               | Auteur uniquement     |

### POST `/documents` — Body (multipart/form-data)
```
titre: "Contrat cadre Fournisseur X"
categorieId: "uuid-categorie"
dateDocument: "2026-04-28"
confidentialite: "INTERNE"
description: "Contrat annuel renouvellement"
tags: ["contrat", "fournisseur", "2026"]
reference: "REF-2026-042"
file: <binary>
```

**Réponse 201 :**
```json
{
  "id": "uuid-doc",
  "titre": "Contrat cadre Fournisseur X",
  "statut": "BROUILLON",
  "currentVersion": {
    "id": "uuid-version",
    "numero": 1,
    "taille": 245760,
    "mimeType": "application/pdf",
    "checksum": "sha256:abc123..."
  },
  "createdAt": "2026-04-28T10:30:00Z"
}
```

### Workflow

| Méthode | Route                              | Description                      | Rôle requis         |
|---------|------------------------------------|----------------------------------|---------------------|
| POST    | `/documents/:id/soumettre`         | Passe BROUILLON → SOUMIS         | Auteur              |
| POST    | `/documents/:id/valider`           | Passe SOUMIS → VALIDE            | ARCHIVISTE / MANAGER|
| POST    | `/documents/:id/rejeter`           | Passe SOUMIS → REJETE            | ARCHIVISTE / MANAGER|
| POST    | `/documents/:id/archiver`          | Passe VALIDE → ARCHIVE           | ARCHIVISTE          |
| POST    | `/documents/:id/proposer-destruction` | Passe ARCHIVE → A_DETRUIRE   | ARCHIVISTE          |
| POST    | `/documents/:id/confirmer-destruction` | Passe A_DETRUIRE → DETRUIT  | ADMIN_FILIALE       |

**POST `/documents/:id/rejeter` — Body :**
```json
{ "motif": "Métadonnées incorrectes, catégorie à corriger." }
```

**POST `/documents/:id/proposer-destruction` — Body :**
```json
{ "justification": "Durée légale de 10 ans atteinte le 2026-03-15." }
```

### Fichiers et versions

| Méthode | Route                             | Description                      | Rôle requis    |
|---------|-----------------------------------|----------------------------------|----------------|
| GET     | `/documents/:id/download`         | Télécharge le fichier courant    | Tout           |
| GET     | `/documents/:id/preview`          | URL de prévisualisation (signed) | Tout           |
| POST    | `/documents/:id/versions`         | Upload une nouvelle version      | Auteur / ARCHIVISTE |
| GET     | `/documents/:id/versions`         | Liste toutes les versions        | Tout           |
| GET     | `/documents/:id/versions/:vId/download` | Télécharge une version     | ARCHIVISTE+    |

### Audit et historique

| Méthode | Route                    | Description                   | Rôle requis    |
|---------|--------------------------|-------------------------------|----------------|
| GET     | `/documents/:id/audit`   | Historique complet du document | ARCHIVISTE+   |

---

## Partages inter-filiales (`/partages`)

| Méthode | Route                     | Description                        | Rôle requis    |
|---------|---------------------------|------------------------------------|----------------|
| GET     | `/partages`               | Liste les partages (émis et reçus) | ARCHIVISTE+    |
| POST    | `/partages`               | Crée un partage                    | ARCHIVISTE+    |
| GET     | `/partages/:id`           | Détail d'un partage                | ARCHIVISTE+    |
| POST    | `/partages/:id/valider`   | Accepte un partage entrant         | ADMIN_FILIALE  |
| POST    | `/partages/:id/refuser`   | Refuse un partage                  | ADMIN_FILIALE  |
| DELETE  | `/partages/:id`           | Révoque un partage actif           | Créateur / ADMIN |

### POST `/partages` — Body
```json
{
  "documentId": "uuid-doc",
  "filialeDestId": "uuid-filiale-dest",
  "expiresAt": "2026-07-28T00:00:00Z",
  "message": "Partagé dans le cadre du projet commun X."
}
```

---

## Administration (`/admin`)

| Méthode | Route                    | Description                          | Rôle requis  |
|---------|--------------------------|--------------------------------------|--------------|
| GET     | `/admin/dashboard`       | Statistiques groupe consolidées      | SUPER_ADMIN  |
| GET     | `/admin/audit`           | Audit log global (toutes filiales)   | SUPER_ADMIN  |
| GET     | `/admin/filiales/:id/stats` | Stats d'une filiale               | SUPER_ADMIN  |

---

## Sécurité des endpoints

Chaque endpoint applique dans l'ordre :
1. Vérification JWT (signature, expiration, issuer)
2. Vérification du rôle minimum requis
3. Vérification que `filialeId` du JWT correspond à la ressource (sauf SUPER_ADMIN)
4. Log dans AuditLog (actions sensibles uniquement — lecture → log si téléchargement)

### Headers de sécurité (tous les endpoints)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### Rate limiting
- Endpoints d'upload : 10 req/min par utilisateur
- Endpoints de recherche : 60 req/min par utilisateur
- Endpoints d'auth : 5 req/min par IP
