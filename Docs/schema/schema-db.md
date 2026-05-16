# Schéma de base de données — GROUPE GI Archives

> Base de données : **Supabase** (PostgreSQL 15, hébergé).
> ORM : **Prisma** avec deux URLs de connexion (pooled + direct).
> Toutes les tables de données métier ont `filialeId` (isolation stricte).

## Configuration Prisma pour Supabase

```prisma
// schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // poolée pgbouncer — utilisée en runtime
  directUrl = env("DIRECT_URL")     // directe — utilisée par prisma migrate
}
```

> **Important :** `DATABASE_URL` pointe sur le port **6543** (pgbouncer, Transaction mode).
> `DIRECT_URL` pointe sur le port **5432** (connexion directe, pour les migrations).
> Ne jamais utiliser `DIRECT_URL` dans le code applicatif (pas de connection pooling).

---

## Entités principales

### Filiale
```prisma
model Filiale {
  id          String   @id @default(uuid())
  code        String   @unique          // ex: "FOMI", "IHL"
  nom         String
  pays        String
  actif       Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]
  categories  Categorie[]
  documents   Document[]
  partagesEmis    PartageInterFiliale[] @relation("FilialeSrc")
  partagesRecus   PartageInterFiliale[] @relation("FilialeDest")
  auditLogs   AuditLog[]
}
```

### User
```prisma
model User {
  id           String   @id @default(uuid())
  keycloakId   String   @unique
  email        String   @unique
  prenom       String
  nom          String
  filialeId    String?  // null = SUPER_ADMIN groupe
  actif        Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  filiale      Filiale? @relation(fields: [filialeId], references: [id])
  roles        UserRole[]
  documents    Document[]       @relation("Auteur")
  versions     DocumentVersion[]
  auditLogs    AuditLog[]
  partagesAutorisés PartageInterFiliale[] @relation("Autorisateur")

  @@index([filialeId])
  @@index([keycloakId])
}
```

### UserRole
```prisma
model UserRole {
  id        String   @id @default(uuid())
  userId    String
  role      Role
  filialeId String?  // null = global (SUPER_ADMIN)

  user      User     @relation(fields: [userId], references: [id])

  @@unique([userId, filialeId])
  @@index([userId])
}

enum Role {
  SUPER_ADMIN
  ADMIN_FILIALE
  ARCHIVISTE
  MANAGER
  COLLABORATEUR
  LECTEUR
}
```

### Categorie
```prisma
model Categorie {
  id                    String   @id @default(uuid())
  code                  String
  libelle               String
  dureeConservationAns  Int?     // null = illimité / permanent
  filialeId             String?  // null = catégorie globale groupe
  actif                 Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  filiale     Filiale?   @relation(fields: [filialeId], references: [id])
  documents   Document[]

  @@unique([code, filialeId])
}
```

### Document
```prisma
model Document {
  id               String          @id @default(uuid())
  titre            String
  description      String?
  categorieId      String
  filialeId        String
  auteurId         String
  statut           StatutDocument  @default(BROUILLON)
  confidentialite  Confidentialite @default(INTERNE)
  dateDocument     DateTime
  dateExpiration   DateTime?       // calculée à la validation
  tags             String[]        @default([])
  auteurExterne    String?
  reference        String?
  contenuOcr       String?         // texte extrait par OCR (non affiché)
  currentVersionId String?         @unique

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  categorie      Categorie         @relation(fields: [categorieId], references: [id])
  filiale        Filiale           @relation(fields: [filialeId], references: [id])
  auteur         User              @relation("Auteur", fields: [auteurId], references: [id])
  currentVersion DocumentVersion?  @relation("CurrentVersion", fields: [currentVersionId], references: [id])
  versions       DocumentVersion[] @relation("Versions")
  auditLogs      AuditLog[]
  partages       PartageInterFiliale[]

  @@index([filialeId])
  @@index([statut])
  @@index([categorieId])
  @@index([dateExpiration])
  @@index([filialeId, statut])
}

enum StatutDocument {
  BROUILLON
  SOUMIS
  REJETE
  VALIDE
  ARCHIVE
  A_DETRUIRE
  DETRUIT
}

enum Confidentialite {
  PUBLIC
  INTERNE
  CONFIDENTIEL
  SECRET
}
```

### DocumentVersion
```prisma
model DocumentVersion {
  id           String   @id @default(uuid())
  documentId   String
  numero       Int
  taille       BigInt   // en octets
  mimeType     String
  checksum     String   // SHA-256 du fichier
  storageKey   String   // chemin MinIO (ex: "fomi/2026/01/uuid.pdf")
  uploadedById String
  createdAt    DateTime @default(now())

  document     Document @relation("Versions", fields: [documentId], references: [id])
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
  currentFor   Document? @relation("CurrentVersion")

  @@unique([documentId, numero])
  @@index([documentId])
}
```

### AuditLog
```prisma
model AuditLog {
  id         String      @id @default(uuid())
  action     ActionAudit
  documentId String?
  userId     String
  filialeId  String
  metadata   Json        @default("{}")  // ip, userAgent, detailsAction, etc.
  createdAt  DateTime    @default(now())

  document   Document?   @relation(fields: [documentId], references: [id])
  user       User        @relation(fields: [userId], references: [id])
  filiale    Filiale     @relation(fields: [filialeId], references: [id])

  @@index([documentId])
  @@index([userId])
  @@index([filialeId])
  @@index([createdAt])
  @@index([action])
}

enum ActionAudit {
  CONNEXION
  DECONNEXION
  UPLOAD
  LECTURE
  TELECHARGEMENT
  MODIFICATION_META
  NOUVELLE_VERSION
  SOUMISSION
  VALIDATION
  REJET
  ARCHIVAGE
  PROPOSITION_DESTRUCTION
  VALIDATION_DESTRUCTION
  DESTRUCTION
  PARTAGE_CREATION
  PARTAGE_VALIDATION
  PARTAGE_ACCES
  PARTAGE_REVOCATION
  EXPORT
  IMPERSONATION
}
```

### PartageInterFiliale
```prisma
model PartageInterFiliale {
  id             String   @id @default(uuid())
  documentId     String
  filialeSrcId   String
  filialeDestId  String
  autorisePar    String
  statut         StatutPartage @default(EN_ATTENTE)
  expiresAt      DateTime?
  actif          Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  document    Document @relation(fields: [documentId], references: [id])
  filialeSrc  Filiale  @relation("FilialeSrc", fields: [filialeSrcId], references: [id])
  filialeDest Filiale  @relation("FilialeDest", fields: [filialeDestId], references: [id])
  autorisateur User   @relation("Autorisateur", fields: [autorisePar], references: [id])

  @@index([documentId])
  @@index([filialeDestId])
  @@index([expiresAt])
}

enum StatutPartage {
  EN_ATTENTE
  ACCEPTE
  REFUSE
  EXPIRE
  REVOQUE
}
```

### CertificatDestruction
```prisma
model CertificatDestruction {
  id              String   @id @default(uuid())
  documentId      String   @unique
  titreDocument   String   // copie du titre (document détruit)
  categorieCode   String
  filialeId       String
  checksumFichier String   // SHA-256 du fichier détruit
  dateCreation    DateTime // date de création du document
  dateDestruction DateTime @default(now())
  validateur1Id   String   // Archiviste
  validateur2Id   String   // Admin_Filiale
  pdfStorageKey   String   // certificat PDF dans MinIO
  createdAt       DateTime @default(now())

  @@index([filialeId])
}
```

---

## Index de performance

Requêtes les plus fréquentes optimisées :

```sql
-- Recherche par filiale + statut (liste documents)
CREATE INDEX idx_document_filiale_statut ON "Document"("filialeId", "statut");

-- Documents expirant bientôt (cron d'alerte)
CREATE INDEX idx_document_expiration ON "Document"("dateExpiration") WHERE "statut" != 'DETRUIT';

-- Audit log par document (historique)
CREATE INDEX idx_audit_document_date ON "AuditLog"("documentId", "createdAt" DESC);

-- Partages actifs vers une filiale
CREATE INDEX idx_partage_dest_actif ON "PartageInterFiliale"("filialeDestId", "actif") WHERE "actif" = true;
```

---

## Notes d'implémentation

- Utiliser **Prisma Migrate** pour toutes les évolutions de schéma.
- Les `String[]` (tags) sont des tableaux PostgreSQL natifs — Prisma les gère nativement.
- Le champ `metadata` de AuditLog est `Json` — PostgreSQL `jsonb` pour les requêtes.
- Ne jamais faire de `UPDATE` sur `DocumentVersion` ou `AuditLog` — immuables par conception.
- `storageKey` dans `DocumentVersion` suit le pattern : `<filialeCode>/<année>/<mois>/<uuid>.<ext>`
