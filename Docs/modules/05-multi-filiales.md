# Module 05 — Multi-filiales

## Objectif

Garantir l'isolation stricte des données entre filiales tout en permettant à la direction du groupe d'avoir une vue consolidée et aux filiales de se partager des documents de façon contrôlée.

---

## Liste des filiales (v1)

| Code          | Nom complet              | Pays          |
|---------------|--------------------------|---------------|
| FOMI          | Fomi                     | Congo (RDC)   |
| IHL           | IHL                      | Congo (RDC)   |
| ITRASAGRI     | Itrasagri                | Congo (RDC)   |
| ITRAPACK      | Itrapack                 | Congo (RDC)   |
| ITRACOM       | Itracom                  | Congo (RDC)   |
| CEMI          | CEMI                     | Congo (RDC)   |
| BCAB          | BCAB                     | Congo (RDC)   |
| FOMI_TZ       | FOMI Tanzanie            | Tanzanie      |
| FOMI_UG       | FOMI Uganda              | Uganda        |
| FOMI_KE       | FOMI Kenya               | Kenya         |
| FOMI_AO       | FOMI Angola              | Angola        |
| INKINZO_VIE   | Inkinzo Assurance (Vie)  | Congo (RDC)   |
| VC            | VC                       | Congo (RDC)   |
| INKINZO_GEN   | Inkinzo Assurance Général| Congo (RDC)   |
| ITRACOM_GARAGE| Itracom Garage           | Congo (RDC)   |

Nouvelles filiales ajoutées par SUPER_ADMIN uniquement via l'interface d'administration.

---

## Isolation des données

### Principe fondamental
**Tout accès aux données est filtré par `filialeId`** — côté backend, sans exception.

### Implémentation NestJS

```typescript
// Chaque requête passe par ce guard
@Injectable()
class FilialeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // extrait du JWT
    const resourceFilialeId = // extrait des params/body

    if (user.role === 'SUPER_ADMIN') return true;
    return user.filialeId === resourceFilialeId;
  }
}
```

### Base de données
- Toutes les tables de données métier ont une colonne `filialeId` (NOT NULL).
- Les requêtes Prisma incluent systématiquement `WHERE filialeId = $1`.
- Pas de jointure cross-filiale sauf pour le SUPER_ADMIN.

---

## Vue consolidée groupe (SUPER_ADMIN)

### Tableau de bord groupe
- Nombre total de documents par filiale et par statut
- Documents expirant dans les 30/60/90 jours (par filiale)
- Activité récente (uploads, validations, destructions)
- Indicateurs de conformité par filiale (% documents en règle)

### Navigation
- SUPER_ADMIN peut "entrer dans le contexte" d'une filiale pour voir son espace complet
- Actions effectuées dans le contexte d'une filiale sont tracées avec `impersonation: true` dans AuditLog

---

## Partage inter-filiales

### Cas d'usage
- FOMI partage un contrat-cadre avec ITRAPACK (même groupe)
- Direction groupe partage un rapport annuel avec toutes les filiales

### Processus

```
1. Archiviste/Manager de filiale A sélectionne un document VALIDE
2. Choisit la(les) filiale(s) destinataire(s)
3. Définit la durée d'accès (7j / 30j / 90j / permanent)
4. Soumet → notification aux Admin_Filiale des filiales B
5. Admin_Filiale B valide ou refuse
6. Si validé → document accessible en lecture seule dans filiale B
7. À expiration ou révocation → accès retiré automatiquement
```

### Règles
- Le document reste propriété de la filiale A (filialeId inchangé)
- La filiale B ne peut ni modifier, ni télécharger le fichier original (sauf autorisation explicite)
- Le partage est visible dans les deux filiales avec badge "Partagé par [FILIALE]"
- Toute consultation depuis filiale B génère un AuditLog avec `filialeAcces = B`

---

## Administration des filiales

### Création d'une filiale (SUPER_ADMIN)
1. Saisir : code, nom, pays, responsable (email)
2. Système crée automatiquement :
   - Entrée en base `Filiale`
   - Groupe Keycloak `filiale-<code>`
   - Catégories de documents par défaut (copiées du template groupe)
   - Espace MinIO dédié : bucket `gi-<code>-documents`
3. Email envoyé au responsable avec lien d'activation

### Désactivation d'une filiale
- Soft delete : `actif = false`
- Les utilisateurs de cette filiale ne peuvent plus se connecter
- Les données sont conservées (conformité légale)
- Les partages actifs vers cette filiale sont suspendus

---

## Spécificités par pays

Chaque filiale peut avoir des durées de conservation différentes selon la législation locale :

| Pays      | Particularités                                |
|-----------|-----------------------------------------------|
| Congo RDC | Droit OHADA, durées proches du droit français |
| Tanzanie  | Common law + réglementation locale            |
| Uganda    | Common law + réglementation locale            |
| Kenya     | Common law, durées parfois plus courtes       |
| Angola    | Droit civil portugais                         |

→ ADMIN_FILIALE peut ajuster les durées de conservation des catégories pour sa filiale (dans les limites définies par SUPER_ADMIN).
