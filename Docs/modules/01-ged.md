# Module 01 — GED (Gestion Électronique de Documents)

## Objectif

Permettre le dépôt, la consultation, la gestion du cycle de vie et le versionning de tout document numérique au sein du GROUPE GI et de ses filiales.

---

## Types de documents supportés

| Catégorie        | Exemples                                      | Durée légale |
|------------------|-----------------------------------------------|-------------|
| Contrats         | Contrats fournisseurs, clients, partenariats  | 10 ans      |
| Comptabilité     | Factures, bilans, grand-livre, justificatifs  | 10 ans      |
| RH               | Contrats de travail, bulletins de paie, congés| 5 ans       |
| Juridique        | Statuts, PV AG, actes notariés                | 30 ans      |
| Courriers        | Lettres officielles, courriels exportés       | 5 ans       |
| Rapports         | Rapports d'activité, audits, études           | 10 ans      |
| Technique        | Plans, cahiers des charges, manuels           | Durée projet|
| Divers           | Tout autre document non catégorisé            | 3 ans       |

## Formats de fichiers acceptés

- Documents : PDF, DOC/DOCX, XLS/XLSX, ODT, ODS
- Images : JPG, PNG, TIFF (scans)
- Archives : ZIP, RAR (contenu inspecté)
- **Taille max par fichier :** 50 MB
- **Taille max par lot (upload multiple) :** 500 MB

---

## Métadonnées d'un document

### Obligatoires
- `titre` — string (max 255 car.)
- `categorieId` — référence à la table Categorie
- `filialeId` — rattachement à une filiale (auto-rempli selon l'utilisateur)
- `dateDocument` — date du document (≠ date de dépôt)
- `confidentialite` — PUBLIC | INTERNE | CONFIDENTIEL | SECRET

### Optionnelles
- `description` — texte libre (max 2000 car.)
- `tags` — tableau de mots-clés libres
- `auteurExterne` — si le document vient d'un tiers
- `reference` — numéro de référence interne

### Calculées (automatiques)
- `auteurId` — l'utilisateur connecté
- `dateDepot` — timestamp serveur
- `dateExpiration` — dateDocument + duréeConservation de la catégorie
- `checksum` — SHA-256 du fichier (intégrité)
- `statut` — état dans le workflow

---

## Workflow de statut

```
BROUILLON → SOUMIS → VALIDE → ARCHIVE → A_DETRUIRE → DETRUIT
                ↘ REJETE → BROUILLON
```

| Statut       | Qui peut y accéder          | Transitions possibles              |
|--------------|-----------------------------|------------------------------------|
| BROUILLON    | Auteur uniquement           | → SOUMIS, suppression              |
| SOUMIS       | Auteur + Archiviste + Manager | → VALIDE, → REJETE               |
| VALIDE       | Tous (selon confidentialité)| → ARCHIVE                          |
| ARCHIVE      | Lecture seule               | → A_DETRUIRE (si dateExpiration ≤ aujourd'hui) |
| A_DETRUIRE   | Archiviste + Admin          | → DETRUIT (double validation)      |
| DETRUIT      | Immutable (log uniquement)  | Aucune                             |

---

## Versionning

- Chaque modification du fichier crée une **nouvelle version** (immuable).
- Les métadonnées peuvent être modifiées sans créer de version.
- Historique complet accessible avec diff des métadonnées.
- Restauration possible vers une version antérieure (crée une v+1).
- La version courante est toujours la dernière validée.

---

## Fonctionnalités détaillées

### Upload
- Drag & drop ou sélecteur de fichier
- Upload multiple (lot)
- Prévisualisation avant confirmation
- Scan antivirus automatique (ClamAV) — rejet si menace détectée
- Extraction automatique des métadonnées PDF (auteur, titre, date)
- OCR automatique (worker async) pour les images/scans → indexation full-text

### Consultation / Prévisualisation
- Visionneuse intégrée (PDF.js pour PDF, image viewer pour images)
- Téléchargement avec log d'audit obligatoire
- Pas de téléchargement pour `SECRET` sauf ADMIN et rôles explicitement autorisés
- Watermark dynamique sur les PDF téléchargés (nom utilisateur + date)

### Modification
- Métadonnées : tout utilisateur ayant accès en écriture
- Fichier : upload d'une nouvelle version (ancienne conservée)
- Pas de modification possible sur statut ARCHIVE ou DETRUIT

### Suppression
- Logique uniquement (soft delete) — jamais de suppression physique immédiate
- Seul l'auteur peut supprimer un BROUILLON
- Les autres statuts : processus de destruction réglementaire uniquement

### Partage inter-filiales
- Un document VALIDE d'une filiale A peut être partagé avec filiale B
- Partage soumis à validation par un Manager ou Archiviste
- Durée de partage limitée (configurable, défaut 30 jours)
- Le destinataire a accès en lecture seule

---

## Règles métier critiques

1. `filialeId` est toujours forcé côté backend — le frontend ne peut pas le falsifier.
2. Tout accès à un document (même lecture) génère un `AuditLog`.
3. Le checksum SHA-256 est vérifié à chaque téléchargement pour garantir l'intégrité.
4. Les documents `CONFIDENTIEL` et `SECRET` ne sont jamais indexés en full-text.
5. Un document ne peut pas être détruit avant sa `dateExpiration` sauf décision judiciaire (tracée).
