# SECURITY.md — Politique de Sécurité et RGPD

> GROUPE GI Archives
> Normes : RGPD, NF Z42-013, ISO 27001, ISO 15489

---

## 1. Authentification et contrôle d'accès

### 1.1 Authentification
- **Supabase Auth** gère l'ensemble des identités.
- Tokens JWT signés HS256 avec `SUPABASE_JWT_SECRET`, vérifiés côté NestJS.
- **Access token TTL :** 1 heure (auto-refresh via `@supabase/supabase-js`). **Refresh token TTL :** 7 jours.
- Rôle et filiale stockés dans `app_metadata` (serveur uniquement, non falsifiable par le client).
- Stockage côté client : géré par le SDK Supabase JS (mémoire + localStorage sécurisé).
- MFA : à activer en production pour ADMIN_FILIALE et SUPER_ADMIN via Supabase Dashboard.

### 1.2 Autorisation
- Modèle **RBAC** (6 rôles — voir `docs/modules/02-auth-roles.md`).
- Triple vérification sur chaque endpoint NestJS :
  1. JWT Supabase valide (`supabase.auth.getUser()`)
  2. Rôle suffisant (`app_metadata.role`)
  3. Appartenance filiale (`app_metadata.filiale_id` == `filialeId` ressource)
- SUPER_ADMIN : accès cross-filiales explicitement autorisé, **toutes ses actions sont tracées** avec flag `impersonation`.
- Principe du moindre privilège : les utilisateurs ont le rôle minimum suffisant pour leur travail.
- Couche supplémentaire : **Row Level Security (RLS)** Supabase activé sur toutes les tables — défense en profondeur même en cas de bug applicatif.

### 1.3 Politique de mots de passe
- Longueur : minimum 12 caractères
- Complexité : majuscule + minuscule + chiffre + caractère spécial
- Historique : 5 derniers mots de passe refusés
- Expiration : 90 jours (avertissement 14j avant)
- Verrouillage : 5 échecs → blocage 15 min (Keycloak brute force protection)

---

## 2. Chiffrement

### 2.1 En transit
- **TLS 1.3 minimum** pour toutes les communications (API, MinIO, Keycloak, Redis).
- Certificats : Let's Encrypt en prod, certificats auto-signés en dev (Docker interne).
- HSTS activé (`max-age=31536000; includeSubDomains`).
- Pas de fallback TLS 1.0/1.1.

### 2.2 Au repos
- **PostgreSQL** : chiffrement au niveau du volume (LUKS ou équivalent selon infra).
- **MinIO** : chiffrement SSE-S3 activé (AES-256) sur tous les buckets.
- **Redis** : chiffrement au niveau du volume + mot de passe obligatoire.
- **Données sensibles en base** (ex. clés de configuration) : chiffrées avec `ENCRYPTION_KEY` (AES-256-GCM) avant stockage.
- **Sauvegardes** : chiffrées avec GPG avant transfert ou stockage externe.

---

## 3. Stockage et intégrité des fichiers

### 3.1 Upload
1. Vérification taille (max 50 MB) avant traitement.
2. Validation type MIME côté serveur (liste blanche — pas confiance au Content-Type client).
3. Scan antivirus **ClamAV** synchrone — rejet immédiat si menace détectée.
4. Calcul **SHA-256** du fichier.
5. Stockage dans MinIO avec le checksum en métadonnée.
6. Stockage du checksum en base (`DocumentVersion.checksum`).

### 3.2 Intégrité
- Le checksum est vérifié **à chaque téléchargement**.
- En cas de divergence : blocage du téléchargement + alerte immédiate à SUPER_ADMIN + ADMIN_FILIALE.
- Les fichiers ne sont jamais modifiés après stockage (immuabilité des versions).

### 3.3 Organisation Supabase Storage
- Un bucket privé par filiale : `gi-<code>` (ex. `gi-fomi`, `gi-ihl`).
- Buckets configurés en **privé** — aucun accès public.
- Toutes les URL sont des **presigned URLs** générées côté backend (durée : 15 min).
- `storageKey` jamais exposé dans les réponses API (chemin interne uniquement).
- Politiques de Storage (RLS Supabase) : seul le `service_role_key` backend peut lire/écrire.

---

## 4. Traçabilité et audit

### 4.1 AuditLog — règles
- **Toute action sensible** est enregistrée : connexion, déconnexion, upload, lecture, téléchargement, modification, validation, archivage, destruction, partage, export, impersonation.
- Les `AuditLog` sont **immuables** : pas d'UPDATE ni DELETE sur cette table (contrainte applicative).
- Les logs ne contiennent **jamais** :
  - Le contenu des fichiers
  - Des données personnelles au-delà du `userId` (résolution via join si besoin)
  - Des mots de passe, tokens ou clés

### 4.2 Rétention des logs
- AuditLog conservés **10 ans minimum** (conformité NF Z42-013).
- Archivage annuel des logs de l'année N-2 dans MinIO (bucket `gi-audit-logs`).

### 4.3 Monitoring
- Alertes en temps réel pour :
  - Tentatives d'accès à une filiale étrangère
  - Anomalies d'intégrité (checksum KO)
  - Pic de téléchargements inhabituels (> 50 fichiers/heure par user)
  - Connexions depuis IPs inhabituelles

---

## 5. Conformité RGPD

### 5.1 Données personnelles traitées
| Donnée              | Finalité                        | Rétention         |
|---------------------|---------------------------------|-------------------|
| Email, prénom, nom  | Identification utilisateur      | Durée du contrat de travail |
| Adresse IP          | Sécurité, audit                 | 12 mois           |
| Logs d'action       | Traçabilité légale              | 10 ans            |
| Contenu des documents | Gestion des archives          | Selon catégorie   |

### 5.2 Droits des personnes (Art. 15-22 RGPD)
- **Droit d'accès** : l'utilisateur peut demander export de ses données → processus manuel via ADMIN_FILIALE sous 30 jours.
- **Droit à l'effacement** (Art. 17) : applicable uniquement si pas d'obligation légale de conservation. Processus manuel tracé.
- **Droit à la portabilité** : export JSON des métadonnées + fichiers (ZIP chiffré).
- **Droit d'opposition** : désactivation du compte possible, logs d'audit conservés (obligation légale).

### 5.3 Transferts internationaux
- Filiales en Tanzanie, Uganda, Kenya, Angola : données stockées sur serveurs locaux ou dans la région (à confirmer avec DPO).
- Clauses contractuelles types (CCT) si transfert vers pays tiers sans décision d'adéquation.

### 5.4 Notification de violation
- En cas de fuite de données : notification à l'autorité de protection des données **dans les 72 heures**.
- Procédure : SUPER_ADMIN → DPO → Autorité compétente.

---

## 6. Sécurité applicative (OWASP Top 10)

| Risque OWASP              | Mesure implémentée                                   |
|---------------------------|------------------------------------------------------|
| Injection SQL             | Prisma ORM (requêtes paramétrées, pas de raw SQL)    |
| Authentification cassée   | Keycloak + JWT RS256 + PKCE                          |
| Exposition données sensibles | TLS partout, chiffrement au repos, presigned URLs |
| Contrôle d'accès cassé    | Triple guard NestJS (auth + role + filiale)          |
| Mauvaise configuration    | Headers sécurité, .env non commité, secrets gérés    |
| XSS                       | React (échappement natif) + CSP strict               |
| CSRF                      | Tokens JWT (pas de cookies session) + SameSite       |
| Composants vulnérables    | Dépendances auditées via `pnpm audit` en CI          |
| Logging insuffisant       | AuditLog complet, alertes monitoring                 |
| SSRF                      | Validation stricte des URLs externes, pas de proxy   |

---

## 7. Gestion des secrets

- **Jamais de secret en dur** dans le code ou les fichiers trackés par git.
- En développement : fichier `.env` (gitignorés).
- En production : variables d'environnement injectées par l'orchestrateur (Kubernetes Secrets ou Vault).
- Rotation des secrets : tous les 90 jours pour les clés critiques.
- Le fichier `.gitignore` doit inclure : `.env`, `*.pem`, `*.key`, `*.p12`, `*.pfx`.

---

## 8. Procédures d'incident

### En cas de suspicion de fuite
1. Désactiver immédiatement les comptes suspects (Keycloak).
2. Invalider tous les tokens actifs (Keycloak → Sessions → Logout all).
3. Analyser les AuditLog pour identifier le périmètre.
4. Notifier DPO et SUPER_ADMIN.
5. Si données personnelles concernées → notification autorité sous 72h.

### En cas d'anomalie d'intégrité
1. Bloquer le téléchargement du document concerné.
2. Comparer le fichier en MinIO avec le checksum en base.
3. Si divergence confirmée : isoler le document (statut `BLOQUE` hors workflow normal).
4. Ouvrir un incident avec horodatage et rapport technique.

---

*Dernière mise à jour : 2026-04-28 — Responsable sécurité : Luc (GROUPE GI)*
