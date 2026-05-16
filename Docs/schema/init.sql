-- ============================================================
-- GROUPE GI Archives — Initialisation base de données
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_FILIALE', 'ARCHIVISTE', 'MANAGER', 'COLLABORATEUR', 'LECTEUR');

CREATE TYPE "StatutDocument" AS ENUM ('BROUILLON', 'SOUMIS', 'REJETE', 'VALIDE', 'ARCHIVE', 'A_DETRUIRE', 'DETRUIT');

CREATE TYPE "Confidentialite" AS ENUM ('PUBLIC', 'INTERNE', 'CONFIDENTIEL', 'SECRET');

CREATE TYPE "ActionAudit" AS ENUM ('CONNEXION', 'DECONNEXION', 'UPLOAD', 'LECTURE', 'TELECHARGEMENT', 'MODIFICATION_META', 'NOUVELLE_VERSION', 'SOUMISSION', 'VALIDATION', 'REJET', 'ARCHIVAGE', 'PROPOSITION_DESTRUCTION', 'VALIDATION_DESTRUCTION', 'DESTRUCTION', 'PARTAGE_CREATION', 'PARTAGE_VALIDATION', 'PARTAGE_ACCES', 'PARTAGE_REVOCATION', 'EXPORT', 'IMPERSONATION');

CREATE TYPE "StatutPartage" AS ENUM ('EN_ATTENTE', 'ACCEPTE', 'REFUSE', 'EXPIRE', 'REVOQUE');

-- CreateTable
CREATE TABLE "Filiale" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Filiale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "keycloakId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "filialeId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "filialeId" TEXT,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Categorie" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dureeConservationAns" INTEGER,
    "filialeId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "categorieId" TEXT NOT NULL,
    "filialeId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "statut" "StatutDocument" NOT NULL DEFAULT 'BROUILLON',
    "confidentialite" "Confidentialite" NOT NULL DEFAULT 'INTERNE',
    "dateDocument" TIMESTAMP(3) NOT NULL,
    "dateExpiration" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "auteurExterne" TEXT,
    "reference" TEXT,
    "contenuOcr" TEXT,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "taille" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "ActionAudit" NOT NULL,
    "documentId" TEXT,
    "userId" TEXT NOT NULL,
    "filialeId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartageInterFiliale" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "filialeSrcId" TEXT NOT NULL,
    "filialeDestId" TEXT NOT NULL,
    "autorisePar" TEXT NOT NULL,
    "statut" "StatutPartage" NOT NULL DEFAULT 'EN_ATTENTE',
    "expiresAt" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartageInterFiliale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificatDestruction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "titreDocument" TEXT NOT NULL,
    "categorieCode" TEXT NOT NULL,
    "filialeId" TEXT NOT NULL,
    "checksumFichier" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL,
    "dateDestruction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validateur1Id" TEXT NOT NULL,
    "validateur2Id" TEXT NOT NULL,
    "pdfStorageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CertificatDestruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Filiale_code_key" ON "Filiale"("code");
CREATE UNIQUE INDEX "User_keycloakId_key" ON "User"("keycloakId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_filialeId_idx" ON "User"("filialeId");
CREATE INDEX "User_keycloakId_idx" ON "User"("keycloakId");
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");
CREATE UNIQUE INDEX "UserRole_userId_filialeId_key" ON "UserRole"("userId", "filialeId");
CREATE UNIQUE INDEX "Categorie_code_filialeId_key" ON "Categorie"("code", "filialeId");
CREATE UNIQUE INDEX "Document_currentVersionId_key" ON "Document"("currentVersionId");
CREATE INDEX "Document_filialeId_idx" ON "Document"("filialeId");
CREATE INDEX "Document_statut_idx" ON "Document"("statut");
CREATE INDEX "Document_categorieId_idx" ON "Document"("categorieId");
CREATE INDEX "Document_dateExpiration_idx" ON "Document"("dateExpiration");
CREATE INDEX "Document_filialeId_statut_idx" ON "Document"("filialeId", "statut");
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");
CREATE UNIQUE INDEX "DocumentVersion_documentId_numero_key" ON "DocumentVersion"("documentId", "numero");
CREATE INDEX "AuditLog_documentId_idx" ON "AuditLog"("documentId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_filialeId_idx" ON "AuditLog"("filialeId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "PartageInterFiliale_documentId_idx" ON "PartageInterFiliale"("documentId");
CREATE INDEX "PartageInterFiliale_filialeDestId_idx" ON "PartageInterFiliale"("filialeDestId");
CREATE INDEX "PartageInterFiliale_expiresAt_idx" ON "PartageInterFiliale"("expiresAt");
CREATE UNIQUE INDEX "CertificatDestruction_documentId_key" ON "CertificatDestruction"("documentId");
CREATE INDEX "CertificatDestruction_filialeId_idx" ON "CertificatDestruction"("filialeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_filialeId_fkey" FOREIGN KEY ("filialeId") REFERENCES "Filiale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Categorie" ADD CONSTRAINT "Categorie_filialeId_fkey" FOREIGN KEY ("filialeId") REFERENCES "Filiale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_filialeId_fkey" FOREIGN KEY ("filialeId") REFERENCES "Filiale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_filialeId_fkey" FOREIGN KEY ("filialeId") REFERENCES "Filiale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartageInterFiliale" ADD CONSTRAINT "PartageInterFiliale_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartageInterFiliale" ADD CONSTRAINT "PartageInterFiliale_filialeSrcId_fkey" FOREIGN KEY ("filialeSrcId") REFERENCES "Filiale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartageInterFiliale" ADD CONSTRAINT "PartageInterFiliale_filialeDestId_fkey" FOREIGN KEY ("filialeDestId") REFERENCES "Filiale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartageInterFiliale" ADD CONSTRAINT "PartageInterFiliale_autorisePar_fkey" FOREIGN KEY ("autorisePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
