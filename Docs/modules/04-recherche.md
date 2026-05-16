# Module 04 — Recherche

## Objectif

Permettre à chaque utilisateur de retrouver rapidement tout document auquel il a accès, via recherche full-text et filtres avancés.

---

## Types de recherche

### Recherche simple
- Barre de recherche unique
- Recherche dans : titre, description, tags, contenu OCR (si indexé)
- Résultats triés par pertinence (score Meilisearch) puis date décroissante
- Suggestions automatiques (autocomplete sur titre/tags)

### Recherche avancée
Formulaire avec les filtres combinables :

| Filtre           | Type          | Valeurs possibles                              |
|------------------|---------------|------------------------------------------------|
| Mots-clés        | Texte libre   | Recherche full-text                            |
| Filiale          | Select        | Filiales accessibles (auto selon rôle)         |
| Catégorie        | Select        | Liste des catégories                           |
| Statut           | Multi-select  | BROUILLON, SOUMIS, VALIDE, ARCHIVE             |
| Confidentialité  | Multi-select  | PUBLIC, INTERNE, CONFIDENTIEL, SECRET          |
| Auteur           | Select        | Utilisateurs de la filiale                     |
| Date du document | Plage dates   | dateDocument entre [début] et [fin]            |
| Date de dépôt    | Plage dates   | dateDepot entre [début] et [fin]               |
| Tags             | Multi-select  | Tags existants + saisie libre                  |
| Type MIME        | Select        | PDF, Word, Excel, Image, Autre                 |
| Expire bientôt   | Booléen       | dateExpiration dans les 90 prochains jours     |

---

## Architecture Meilisearch

### Index : `documents`

**Champs indexés (searchable) :**
- `titre` (poids fort)
- `description` (poids moyen)
- `tags` (poids moyen)
- `contenuOcr` (poids faible) — uniquement si confidentialité ≠ CONFIDENTIEL/SECRET

**Champs filtrables (filterable) :**
- `filialeId`, `categorieId`, `statut`, `confidentialite`
- `auteurId`, `typeMime`
- `dateDocument` (timestamp unix)
- `dateDepot` (timestamp unix)
- `dateExpiration` (timestamp unix)

**Champs triables (sortable) :**
- `dateDocument`, `dateDepot`, `titre`

**Champs affichés (displayedAttributes) :**
- `id`, `titre`, `description`, `statut`, `filialeId`, `categorieId`, `tags`, `dateDocument`, `auteurId`
- **Pas** `contenuOcr` (trop volumineux dans les résultats)
- **Pas** `storageKey` (chemin MinIO — information sensible)

### Mise à jour de l'index
- **Création document** : indexation immédiate (synchrone si < 1s) ou async via BullMQ
- **Modification métadonnées** : réindexation partielle
- **Changement statut** : réindexation (pour exclure DETRUIT des résultats)
- **OCR terminé** : ajout du `contenuOcr` à l'index
- **Destruction** : suppression de l'index Meilisearch

---

## Cloisonnement par filiale dans la recherche

**Règle absolue :** l'API injecte toujours un filtre `filialeId = <id_du_token>` avant d'envoyer la requête à Meilisearch. Le frontend ne peut pas contourner ce filtre.

Exception SUPER_ADMIN : peut chercher dans toutes les filiales, avec un filtre `filialeId IN [liste]` optionnel.

---

## OCR (extraction de contenu)

### Déclenchement
- Automatique à l'upload pour : images (JPG, PNG, TIFF), PDF image (non-texte)
- Manuel possible pour les autres PDF (via bouton "Indexer le contenu")

### Pipeline (worker async)
```
1. Document uploadé dans MinIO
2. Message BullMQ → queue "ocr"
3. Worker télécharge le fichier depuis MinIO
4. Tesseract OCR (multilingue : FR, EN, Swahili)
5. Texte extrait → nettoyage et tronqué à 50 000 car.
6. Mise à jour document.contenuOcr en base
7. Réindexation dans Meilisearch
8. Notification "indexation terminée" (si demandée)
```

### Langues supportées
- Français (principal)
- Anglais
- Swahili (pour filiales est-africaines)
- Portugais (pour FOMI Angola)

---

## Performance et limites

| Paramètre                    | Valeur       |
|------------------------------|-------------|
| Résultats par page (défaut)  | 20          |
| Résultats par page (max)     | 100         |
| Délai de réponse cible       | < 200 ms    |
| Taille max contenu OCR indexé| 50 000 car. |
| Documents SECRET indexés     | ❌ Jamais   |
| Documents CONFIDENTIEL indexés | Titre/tags uniquement (pas contenu OCR) |

---

## Export des résultats

- Export CSV des métadonnées des résultats (sans fichiers)
- Export ZIP des fichiers (max 50 documents par export, avec AuditLog)
- Disponible pour : ARCHIVISTE, MANAGER, ADMIN, SUPER_ADMIN
