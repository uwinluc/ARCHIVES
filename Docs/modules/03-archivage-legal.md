# Module 03 — Archivage Légal

## Objectif

Garantir la conformité légale des archives numériques : durées de conservation, intégrité des preuves, traçabilité de la destruction, et valeur probante des documents.

Normes visées : **NF Z42-013**, **ISO 15489**, **RGPD**.

---

## Durées de conservation par catégorie

| Catégorie              | Durée légale | Base légale                          | Action à l'expiration  |
|------------------------|:------------:|---------------------------------------|------------------------|
| Contrats commerciaux   | 10 ans       | Code de commerce                      | Proposition destruction|
| Factures / comptabilité| 10 ans       | Code général des impôts               | Proposition destruction|
| Bulletins de paie      | 5 ans        | Code du travail                       | Proposition destruction|
| Contrats de travail    | 5 ans après départ | Code du travail               | Proposition destruction|
| Statuts société / PV AG| 30 ans       | Code de commerce                      | Archivage permanent    |
| Actes notariés         | 75 ans       | Droit civil                           | Archivage permanent    |
| Courriers officiels    | 5 ans        | —                                     | Proposition destruction|
| Rapports internes      | 10 ans       | Politique interne groupe              | Proposition destruction|
| Documents techniques   | Durée projet + 5 ans | Droit de la responsabilité  | Proposition destruction|
| Données personnelles RGPD | Durée traitement | RGPD Art. 5(1)(e)           | Suppression obligatoire|

Les durées sont configurables par SUPER_ADMIN pour couvrir les variations entre pays (Congo, Tanzanie, Uganda, Kenya, Angola).

---

## Cycle de vie complet

### États et transitions

```
BROUILLON
   │
   ▼ (soumission par l'auteur)
SOUMIS
   │  ╲
   │   ▼ (rejet par archiviste/manager)
   │  REJETE ──► BROUILLON (correction)
   │
   ▼ (validation par archiviste/manager)
VALIDE
   │
   ▼ (archivage manuel ou automatique à dateExpiration)
ARCHIVE ◄──── (les documents validés peuvent être archivés manuellement)
   │
   ▼ (déclenchement par système ou archiviste si dateExpiration ≤ aujourd'hui)
A_DETRUIRE
   │
   ▼ (double validation : archiviste PUIS admin_filiale)
DETRUIT (immuable)
```

### Règles de transition

- `SOUMIS → VALIDE` : Archiviste ou Manager de la filiale
- `VALIDE → ARCHIVE` : Archiviste uniquement, ou automatique à dateExpiration
- `ARCHIVE → A_DETRUIRE` : Système automatique si dateExpiration dépassée, ou Archiviste manuellement
- `A_DETRUIRE → DETRUIT` : **Double validation obligatoire** (Archiviste + Admin_Filiale, personnes différentes)
- Pas de retour possible depuis ARCHIVE, A_DETRUIRE ou DETRUIT

---

## Processus de destruction

### 1. Déclenchement
- Automatique : tâche cron quotidienne qui identifie les documents avec `dateExpiration < aujourd'hui` et statut `ARCHIVE` → passage à `A_DETRUIRE`
- Manuel : Archiviste peut proposer la destruction avant terme (avec justification obligatoire)

### 2. Double validation
```
Archiviste soumet la destruction
   → Notification au Admin_Filiale
   → Admin_Filiale valide (dans les 30 jours, sinon rappel)
   → Destruction effective
```

### 3. Destruction physique
- Suppression du fichier dans MinIO
- Le document reste en base avec statut `DETRUIT` (métadonnées conservées 10 ans)
- Génération d'un **certificat de destruction** (PDF signé, horodaté)

### Certificat de destruction
Contient :
- Référence du document (ID, titre, catégorie)
- Filiale concernée
- Date de création et date de destruction
- Durée de conservation appliquée
- Identité des deux validateurs
- Checksum du fichier détruit (preuve que le bon fichier a été effacé)
- Signature numérique du système

---

## Intégrité et valeur probante

### Chaîne de confiance
- **Checksum SHA-256** calculé à l'upload, vérifié à chaque accès
- **Horodatage serveur** (timestamp UTC) sur chaque action
- **Immuabilité** : aucun fichier archivé n'est modifiable (nouvelle version = nouveau document)
- **Journalisation** : chaque action dans `AuditLog` avec IP, userAgent, timestamp

### Conformité NF Z42-013
- Intégrité : checksum SHA-256 ✅
- Lisibilité : formats pérennes recommandés (PDF/A) ✅
- Traçabilité : AuditLog complet ✅
- Durabilité : politique de sauvegarde MinIO (réplication) ✅
- Réversibilité : export des données en formats standards ✅

---

## Alertes et notifications automatiques

| Événement                          | Destinataire          | Délai        |
|------------------------------------|----------------------|--------------|
| Document proche expiration         | Archiviste filiale   | 90 jours avant |
| Document expiré non archivé        | Archiviste + Admin   | Immédiat     |
| Document en attente destruction    | Admin_Filiale        | Immédiat     |
| Rappel validation destruction      | Admin_Filiale        | 7 jours après|
| Destruction effectuée              | Archiviste + Admin   | Immédiat     |
| Anomalie d'intégrité (checksum KO) | SUPER_ADMIN + Admin  | Immédiat     |

---

## Cas particulier RGPD

Les documents contenant des données personnelles ont une logique spécifique :
- `dateExpiration` = date de fin de la finalité du traitement
- À expiration : **suppression obligatoire** (pas seulement archivage)
- Droit à l'effacement (Art. 17 RGPD) : procédure manuelle déclenchée par Admin, avec justification et trace
- Registre des traitements : module dédié Phase 2
