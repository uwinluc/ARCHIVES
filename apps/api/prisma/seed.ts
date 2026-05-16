/**
 * Seed GROUPE GI — données fictives de démonstration
 * Utilise le client Supabase (service role) directement, sans Prisma Accelerate.
 * Exécution : pnpm --filter @gi/api db:seed
 */

import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PASSWORD = 'GiArchives2026!'

const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ────────────────────────────────────────────────────────────────

function fakeChecksum() { return randomBytes(32).toString('hex') }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const NOW = new Date().toISOString()

// Tables with createdAt + updatedAt
const HAS_BOTH = new Set(['Filiale', 'User', 'Categorie', 'Document', 'PartageInterFiliale'])
// Tables with createdAt only
const HAS_CREATED_ONLY = new Set(['AuditLog', 'DocumentVersion'])
// UserRole has no timestamps at all

function withTimestamps(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  if (HAS_BOTH.has(table)) {
    if (!out.createdAt) out.createdAt = NOW
    if (!out.updatedAt) out.updatedAt = NOW
  } else if (HAS_CREATED_ONLY.has(table)) {
    if (!out.createdAt) out.createdAt = NOW
  }
  return out
}

async function dbInsert(table: string, row: Record<string, unknown>) {
  const { data, error } = await sb.from(table).insert(withTimestamps(table, row)).select().single()
  if (error) throw new Error(`INSERT ${table}: ${error.message} — ${JSON.stringify(error)}`)
  return data as Record<string, string>
}

async function dbUpsert(table: string, row: Record<string, unknown>, onConflict: string) {
  const { data, error } = await sb.from(table).upsert(withTimestamps(table, row), { onConflict }).select().single()
  if (error) throw new Error(`UPSERT ${table}: ${error.message}`)
  return data as Record<string, string>
}

async function dbUpdate(table: string, match: Record<string, unknown>, data: Record<string, unknown>) {
  const q = Object.entries(match).reduce((acc, [k, v]) => acc.eq(k, v as string), sb.from(table).update(data))
  const { error } = await q
  if (error) throw new Error(`UPDATE ${table}: ${error.message}`)
}

async function getOrCreateAuthUser(email: string, prenom: string, nom: string) {
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const existing = (list?.users as any[])?.find((u) => u.email === email)
  if (existing) {
    await sb.auth.admin.updateUserById(existing.id, { password: PASSWORD })
    console.log(`  ↻  ${email} (existant, mot de passe réinitialisé)`)
    return existing.id
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { prenom, nom },
  })
  if (error) throw new Error(`Auth createUser(${email}): ${error.message}`)
  console.log(`  ✓  ${email}`)
  return data.user.id
}

// ── Données maîtres ────────────────────────────────────────────────────────

const FILIALES = [
  { code: 'FOMI',      nom: 'Forestière et Mines de Guinée',    pays: 'Guinée' },
  { code: 'IHL',       nom: 'Immobilier & Hôtellerie Ltd',      pays: "Côte d'Ivoire" },
  { code: 'ITRASAGRI', nom: 'Transport & Agriculture du Sahel', pays: 'Sénégal' },
  { code: 'SOGAS',     nom: 'Société Gazière Africaine',        pays: 'Gabon' },
]

const CATEGORIES = [
  { code: 'CTR',  libelle: 'Contrats',               dureeConservationAns: 10   },
  { code: 'FAC',  libelle: 'Factures & Comptabilité', dureeConservationAns: 7    },
  { code: 'RAF',  libelle: 'Rapports Financiers',     dureeConservationAns: 10   },
  { code: 'RH',   libelle: 'Ressources Humaines',     dureeConservationAns: 5    },
  { code: 'CRSP', libelle: 'Correspondances',          dureeConservationAns: 3    },
  { code: 'JUR',  libelle: 'Documents Juridiques',    dureeConservationAns: null },
]

const FILIALE_PERSONNEL: Record<string, { prenom: string; nom: string }[]> = {
  FOMI:      [{ prenom: 'Aminata', nom: 'DIALLO' }, { prenom: 'Ibrahim', nom: 'CAMARA' }, { prenom: 'Mariama', nom: 'BAH' }, { prenom: 'Oumar', nom: 'BARRY' }],
  IHL:       [{ prenom: 'Aya', nom: 'KOUASSI' }, { prenom: 'Koffi', nom: 'ABIDJAN' }, { prenom: 'Adjoua', nom: 'YAO' }, { prenom: 'Léonce', nom: "N'GUESSAN" }],
  ITRASAGRI: [{ prenom: 'Fatou', nom: 'NDIAYE' }, { prenom: 'Mamadou', nom: 'DIOP' }, { prenom: 'Khady', nom: 'FALL' }, { prenom: 'Ibrahima', nom: 'SY' }],
  SOGAS:     [{ prenom: 'Patience', nom: 'ONDO' }, { prenom: 'Gaëtan', nom: 'MBOUMBA' }, { prenom: 'Brice', nom: 'NGUEMA' }, { prenom: 'Carine', nom: 'MOUSSAVOU' }],
}

const ROLE_LABELS = ['admin', 'archiviste', 'manager', 'collaborateur'] as const
const ROLE_NEST: Record<string, string> = {
  admin: 'ADMIN_FILIALE', archiviste: 'ARCHIVISTE', manager: 'MANAGER', collaborateur: 'COLLABORATEUR',
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  GROUPE GI — Seed démarré\n')

  // ── 1. Filiales ──────────────────────────────────────────────────────

  console.log('📍 Filiales...')
  const filialeMap: Record<string, string> = {}
  for (const f of FILIALES) {
    const row = await dbUpsert('Filiale', { id: randomUUID(), code: f.code, nom: f.nom, pays: f.pays, actif: true }, 'code')
    filialeMap[f.code] = row.id
    console.log(`  ✓  ${f.code} — ${f.nom}`)
  }

  // ── 2. Catégories globales ───────────────────────────────────────────

  console.log('\n📂 Catégories...')
  const catMap: Record<string, string> = {}
  for (const c of CATEGORIES) {
    // Check if exists
    const { data: existing } = await sb.from('Categorie').select('id').eq('code', c.code).is('filialeId', null).maybeSingle()
    let catId: string
    if (existing) {
      catId = (existing as any).id
      console.log(`  ↻  [${c.code}] ${c.libelle} (existant)`)
    } else {
      const row = await dbInsert('Categorie', { id: randomUUID(), code: c.code, libelle: c.libelle, dureeConservationAns: c.dureeConservationAns, filialeId: null, actif: true })
      catId = row.id
      console.log(`  ✓  [${c.code}] ${c.libelle}`)
    }
    catMap[c.code] = catId
  }

  // ── 3. Supabase Auth users ───────────────────────────────────────────

  console.log('\n👤 Utilisateurs Supabase Auth...')
  const superAdminAuthId = await getOrCreateAuthUser('admin@groupe-gi.com', 'Kofi', 'MENSAH')
  await sb.auth.admin.updateUserById(superAdminAuthId, {
    app_metadata: { role: 'SUPER_ADMIN', filiale_id: null, filiale_code: null },
  })

  const filialeAuthIds: Record<string, Record<string, string>> = {}
  for (const code of Object.keys(FILIALE_PERSONNEL)) {
    filialeAuthIds[code] = {}
    for (let i = 0; i < ROLE_LABELS.length; i++) {
      const role = ROLE_LABELS[i]
      const p = FILIALE_PERSONNEL[code][i]
      const email = `${role}.${code.toLowerCase()}@groupe-gi.com`
      filialeAuthIds[code][role] = await getOrCreateAuthUser(email, p.prenom, p.nom)
      await sb.auth.admin.updateUserById(filialeAuthIds[code][role], {
        app_metadata: { role: ROLE_NEST[role], filiale_id: filialeMap[code], filiale_code: code },
      })
    }
  }

  // ── 4. Users DB ─────────────────────────────────────────────────────

  console.log('\n💾 Enregistrement utilisateurs en base...')

  async function upsertUser(keycloakId: string, email: string, prenom: string, nom: string, filialeId: string | null) {
    const { data: existing } = await sb.from('User').select('id').eq('keycloakId', keycloakId).maybeSingle()
    if (existing) return (existing as any).id
    const row = await dbInsert('User', { id: randomUUID(), keycloakId, email, prenom, nom, filialeId, actif: true })
    return row.id
  }

  async function upsertRole(userId: string, role: string, filialeId: string | null) {
    const { data: existing } = await sb.from('UserRole').select('id').eq('userId', userId).is('filialeId', filialeId ?? null).maybeSingle()
    if (existing) return
    await dbInsert('UserRole', { id: randomUUID(), userId, role, filialeId })
  }

  const superAdminDbId = await upsertUser(superAdminAuthId, 'admin@groupe-gi.com', 'Kofi', 'MENSAH', null)
  await upsertRole(superAdminDbId, 'SUPER_ADMIN', null)
  console.log('  ✓  Kofi MENSAH — SUPER_ADMIN')

  const dbUserMap: Record<string, Record<string, string>> = {}
  for (const code of Object.keys(FILIALE_PERSONNEL)) {
    dbUserMap[code] = {}
    const filialeId = filialeMap[code]
    for (let i = 0; i < ROLE_LABELS.length; i++) {
      const role = ROLE_LABELS[i]
      const p = FILIALE_PERSONNEL[code][i]
      const email = `${role}.${code.toLowerCase()}@groupe-gi.com`
      const authId = filialeAuthIds[code][role]
      const dbId = await upsertUser(authId, email, p.prenom, p.nom, filialeId)
      await upsertRole(dbId, ROLE_NEST[role], filialeId)
      dbUserMap[code][role] = dbId
      console.log(`  ✓  ${p.prenom} ${p.nom} — ${ROLE_NEST[role]} (${code})`)
    }
  }

  // ── 5. Documents ─────────────────────────────────────────────────────

  console.log('\n📄 Documents...')

  type DocSpec = {
    titre: string; catCode: string; statut: string; confidentialite?: string
    tags?: string[]; dateDocument: string; dateExpiration?: string
    auteurRole: typeof ROLE_LABELS[number]; description?: string
  }

  const docsParFiliale: Record<string, DocSpec[]> = {
    FOMI: [
      { titre: "Contrat d'exploitation minière — Zone Nord", catCode: 'CTR', statut: 'VALIDE', confidentialite: 'CONFIDENTIEL', tags: ['mine', 'exploitation', 'zone-nord'], dateDocument: daysAgo(180), dateExpiration: daysFromNow(3480), auteurRole: 'admin', description: "<p>Contrat principal d'exploitation de la zone Nord conclu avec le partenaire technique.</p>" },
      { titre: 'Rapport financier T1 2026', catCode: 'RAF', statut: 'VALIDE', tags: ['financier', '2026', 'T1'], dateDocument: daysAgo(45), auteurRole: 'manager' },
      { titre: 'Factures équipements lourds — Mars 2026', catCode: 'FAC', statut: 'SOUMIS', tags: ['factures', 'équipements'], dateDocument: daysAgo(15), auteurRole: 'collaborateur' },
      { titre: 'Contrat prestataire sécurité 2026', catCode: 'CTR', statut: 'BROUILLON', tags: ['sécurité', 'prestataire'], dateDocument: daysAgo(5), auteurRole: 'collaborateur' },
      { titre: 'Rapport audit environnemental', catCode: 'RAF', statut: 'REJETE', tags: ['audit', 'environnement'], dateDocument: daysAgo(90), auteurRole: 'manager' },
      { titre: 'Contrats RH — Ingénieurs expatriés', catCode: 'RH', statut: 'ARCHIVE', confidentialite: 'CONFIDENTIEL', tags: ['RH', 'expatriés'], dateDocument: daysAgo(730), dateExpiration: daysAgo(30), auteurRole: 'admin' },
      { titre: "Permis d'exploitation — Renouvellement", catCode: 'JUR', statut: 'A_DETRUIRE', tags: ['permis', 'légal'], dateDocument: daysAgo(1825), dateExpiration: daysAgo(60), auteurRole: 'archiviste' },
      { titre: 'Correspondance Ministère des Mines', catCode: 'CRSP', statut: 'VALIDE', tags: ['ministère', 'officiel'], dateDocument: daysAgo(120), auteurRole: 'admin' },
      { titre: 'Fiches de paie — Cadres Q1 2026', catCode: 'RH', statut: 'VALIDE', confidentialite: 'SECRET', tags: ['paie', 'RH'], dateDocument: daysAgo(60), auteurRole: 'admin' },
      { titre: 'Procès-verbal AG 2025', catCode: 'JUR', statut: 'VALIDE', tags: ['AG', 'PV', '2025'], dateDocument: daysAgo(200), auteurRole: 'admin' },
    ],
    IHL: [
      { titre: 'Bail commercial — Immeuble Plateau', catCode: 'CTR', statut: 'VALIDE', confidentialite: 'CONFIDENTIEL', tags: ['bail', 'Abidjan', 'plateau'], dateDocument: daysAgo(300), dateExpiration: daysFromNow(1095), auteurRole: 'admin' },
      { titre: 'Devis rénovation Hôtel Cocody', catCode: 'FAC', statut: 'SOUMIS', tags: ['rénovation', 'hôtel'], dateDocument: daysAgo(10), auteurRole: 'collaborateur' },
      { titre: 'Rapport financier annuel 2025', catCode: 'RAF', statut: 'VALIDE', tags: ['financier', '2025'], dateDocument: daysAgo(120), auteurRole: 'manager' },
      { titre: 'Contrat entretien — Résidence Marcory', catCode: 'CTR', statut: 'BROUILLON', tags: ['entretien', 'résidence'], dateDocument: daysAgo(3), auteurRole: 'collaborateur' },
      { titre: 'Certificat de conformité — Tour GI', catCode: 'JUR', statut: 'VALIDE', tags: ['conformité', 'légal'], dateDocument: daysAgo(500), auteurRole: 'admin' },
      { titre: 'Factures travaux T4 2025', catCode: 'FAC', statut: 'ARCHIVE', tags: ['travaux', 'factures'], dateDocument: daysAgo(400), auteurRole: 'archiviste' },
      { titre: 'Contrat location bureau — Marcory Zone 4', catCode: 'CTR', statut: 'SOUMIS', tags: ['location', 'bureau'], dateDocument: daysAgo(7), auteurRole: 'manager' },
      { titre: 'Plan de masse — Résidence Les Palmiers', catCode: 'JUR', statut: 'VALIDE', confidentialite: 'CONFIDENTIEL', tags: ['plan', 'immobilier'], dateDocument: daysAgo(600), auteurRole: 'admin' },
    ],
    ITRASAGRI: [
      { titre: 'Contrat transport céréales — Campagne 2026', catCode: 'CTR', statut: 'VALIDE', tags: ['transport', 'céréales', '2026'], dateDocument: daysAgo(60), auteurRole: 'admin' },
      { titre: 'Rapport logistique Q1 2026', catCode: 'RAF', statut: 'SOUMIS', tags: ['logistique', '2026'], dateDocument: daysAgo(20), auteurRole: 'manager' },
      { titre: 'Factures carburant — Flotte Dakar', catCode: 'FAC', statut: 'VALIDE', tags: ['carburant', 'flotte'], dateDocument: daysAgo(90), auteurRole: 'collaborateur' },
      { titre: 'Contrat fournisseur semences', catCode: 'CTR', statut: 'BROUILLON', tags: ['agriculture', 'semences'], dateDocument: daysAgo(2), auteurRole: 'collaborateur' },
      { titre: "Accord partenariat — Coopérative Louga", catCode: 'CTR', statut: 'VALIDE', tags: ['partenariat', 'coopérative'], dateDocument: daysAgo(365), auteurRole: 'admin' },
      { titre: "Registre camions — Renouvellement cartes grises", catCode: 'JUR', statut: 'SOUMIS', tags: ['camions', 'légal'], dateDocument: daysAgo(14), auteurRole: 'archiviste' },
      { titre: 'Rapport phytosanitaire — Zone Casamance', catCode: 'RAF', statut: 'REJETE', tags: ['agriculture', 'Casamance'], dateDocument: daysAgo(80), auteurRole: 'manager' },
      { titre: 'Contrats saisonniers — Récolte 2025', catCode: 'RH', statut: 'ARCHIVE', tags: ['RH', 'saisonniers', '2025'], dateDocument: daysAgo(800), dateExpiration: daysAgo(180), auteurRole: 'admin' },
    ],
    SOGAS: [
      { titre: 'Convention distribution gaz — Libreville', catCode: 'CTR', statut: 'VALIDE', confidentialite: 'CONFIDENTIEL', tags: ['gaz', 'Libreville'], dateDocument: daysAgo(250), dateExpiration: daysFromNow(850), auteurRole: 'admin' },
      { titre: 'Rapport sécurité installations Q1 2026', catCode: 'RAF', statut: 'SOUMIS', tags: ['sécurité', 'installations'], dateDocument: daysAgo(18), auteurRole: 'manager' },
      { titre: 'Factures SEEG — Janv. à Mars 2026', catCode: 'FAC', statut: 'VALIDE', tags: ['factures', 'énergie'], dateDocument: daysAgo(50), auteurRole: 'collaborateur' },
      { titre: 'Contrat maintenance réservoirs', catCode: 'CTR', statut: 'BROUILLON', tags: ['maintenance', 'réservoirs'], dateDocument: daysAgo(4), auteurRole: 'collaborateur' },
      { titre: 'Autorisation exploitation GPL', catCode: 'JUR', statut: 'VALIDE', confidentialite: 'CONFIDENTIEL', tags: ['GPL', 'autorisation'], dateDocument: daysAgo(900), dateExpiration: daysFromNow(465), auteurRole: 'admin' },
      { titre: 'Plan ORSEC interne — Site Owendo', catCode: 'JUR', statut: 'A_DETRUIRE', confidentialite: 'SECRET', tags: ['ORSEC', 'urgence'], dateDocument: daysAgo(1460), dateExpiration: daysAgo(90), auteurRole: 'archiviste' },
      { titre: 'Rapport financier 2025 — Exercice complet', catCode: 'RAF', statut: 'VALIDE', tags: ['financier', '2025'], dateDocument: daysAgo(110), auteurRole: 'admin' },
    ],
  }

  const sharedDocIds: { fomi: string[]; ihl: string[] } = { fomi: [], ihl: [] }

  for (const [code, docs] of Object.entries(docsParFiliale)) {
    const filialeId = filialeMap[code]
    const users = dbUserMap[code]

    for (const spec of docs) {
      const auteurId = users[spec.auteurRole]
      const catId = catMap[spec.catCode]

      // Create document (sans currentVersionId)
      const docId = randomUUID()
      await dbInsert('Document', {
        id: docId,
        titre: spec.titre,
        description: spec.description ?? null,
        categorieId: catId,
        filialeId,
        auteurId,
        statut: spec.statut,
        confidentialite: spec.confidentialite ?? 'INTERNE',
        dateDocument: spec.dateDocument,
        dateExpiration: spec.dateExpiration ?? null,
        tags: spec.tags ?? [],
        currentVersionId: null,
      })

      // Create version
      const ext = spec.catCode === 'FAC' ? 'xlsx' : 'pdf'
      const mimeType = ext === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf'
      const versionId = randomUUID()
      await dbInsert('DocumentVersion', {
        id: versionId,
        documentId: docId,
        numero: 1,
        taille: Math.floor(Math.random() * 4000000) + 50000,
        mimeType,
        checksum: fakeChecksum(),
        storageKey: `${code.toLowerCase()}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${docId}.${ext}`,
        uploadedById: auteurId,
      })

      // Link version → document
      await dbUpdate('Document', { id: docId }, { currentVersionId: versionId })

      // Audit logs
      const baseTime = new Date(spec.dateDocument).getTime()
      const auditLogs: Record<string, unknown>[] = [
        { id: randomUUID(), action: 'UPLOAD', documentId: docId, userId: auteurId, filialeId, metadata: { titre: spec.titre }, createdAt: new Date(baseTime + 3600000).toISOString() },
      ]
      if (spec.statut !== 'BROUILLON') {
        auditLogs.push({ id: randomUUID(), action: 'SOUMISSION', documentId: docId, userId: users['manager'] ?? auteurId, filialeId, metadata: {}, createdAt: new Date(baseTime + 7200000).toISOString() })
      }
      if (['VALIDE', 'ARCHIVE', 'A_DETRUIRE'].includes(spec.statut)) {
        auditLogs.push({ id: randomUUID(), action: 'VALIDATION', documentId: docId, userId: users['admin'], filialeId, metadata: {}, createdAt: new Date(baseTime + 86400000).toISOString() })
      }
      if (spec.statut === 'REJETE') {
        auditLogs.push({ id: randomUUID(), action: 'REJET', documentId: docId, userId: users['admin'], filialeId, metadata: { motif: 'Document incomplet — pièces justificatives manquantes.' }, createdAt: new Date(baseTime + 86400000).toISOString() })
      }
      if (spec.statut === 'ARCHIVE') {
        auditLogs.push({ id: randomUUID(), action: 'ARCHIVAGE', documentId: docId, userId: users['archiviste'], filialeId, metadata: {}, createdAt: new Date(baseTime + 172800000).toISOString() })
      }
      if (spec.statut === 'A_DETRUIRE') {
        auditLogs.push({ id: randomUUID(), action: 'PROPOSITION_DESTRUCTION', documentId: docId, userId: users['archiviste'], filialeId, metadata: { motif: 'Durée légale de conservation dépassée.' }, createdAt: new Date().toISOString() })
      }
      if (['VALIDE', 'ARCHIVE'].includes(spec.statut)) {
        auditLogs.push({ id: randomUUID(), action: 'TELECHARGEMENT', documentId: docId, userId: users['manager'] ?? auteurId, filialeId, metadata: {}, createdAt: daysAgo(Math.floor(Math.random() * 20)) })
      }

      const { error: logError } = await sb.from('AuditLog').insert(auditLogs)
      if (logError) throw new Error(`AuditLog batch: ${logError.message}`)

      if (code === 'FOMI' && spec.statut === 'VALIDE') sharedDocIds.fomi.push(docId)
      if (code === 'IHL'  && spec.statut === 'VALIDE') sharedDocIds.ihl.push(docId)

      console.log(`  ✓  [${code}] ${spec.titre.slice(0, 48)} (${spec.statut})`)
    }
  }

  // ── 6. Partages inter-filiale ──────────────────────────────────────────

  console.log('\n🔗 Partages inter-filiale...')

  if (sharedDocIds.fomi[0]) {
    await dbInsert('PartageInterFiliale', { id: randomUUID(), documentId: sharedDocIds.fomi[0], filialeSrcId: filialeMap['FOMI'], filialeDestId: filialeMap['IHL'], autorisePar: dbUserMap['FOMI']['admin'], statut: 'ACCEPTE', expiresAt: daysFromNow(90), actif: true })
    await dbInsert('AuditLog', { id: randomUUID(), action: 'PARTAGE_CREATION', documentId: sharedDocIds.fomi[0], userId: dbUserMap['FOMI']['admin'], filialeId: filialeMap['FOMI'], metadata: { destFiliale: 'IHL' }, createdAt: new Date().toISOString() })
    console.log('  ✓  FOMI → IHL (ACCEPTE, expire dans 90j)')
  }
  if (sharedDocIds.ihl[0]) {
    await dbInsert('PartageInterFiliale', { id: randomUUID(), documentId: sharedDocIds.ihl[0], filialeSrcId: filialeMap['IHL'], filialeDestId: filialeMap['SOGAS'], autorisePar: dbUserMap['IHL']['admin'], statut: 'EN_ATTENTE', expiresAt: daysFromNow(30), actif: true })
    console.log('  ✓  IHL → SOGAS (EN_ATTENTE)')
  }
  if (sharedDocIds.fomi[1]) {
    await dbInsert('PartageInterFiliale', { id: randomUUID(), documentId: sharedDocIds.fomi[1], filialeSrcId: filialeMap['FOMI'], filialeDestId: filialeMap['ITRASAGRI'], autorisePar: superAdminDbId, statut: 'EXPIRE', expiresAt: daysAgo(10), actif: false })
    console.log('  ✓  FOMI → ITRASAGRI (EXPIRE)')
  }

  // ── Résumé ─────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(58))
  console.log('✅  Seed terminé avec succès !\n')
  console.log(`🔑  Mot de passe pour tous les comptes : ${PASSWORD}\n`)
  console.log('    admin@groupe-gi.com                  → SUPER_ADMIN')
  for (const code of Object.keys(FILIALE_PERSONNEL)) {
    const c = code.toLowerCase()
    console.log(`    admin.${c}@groupe-gi.com         → ADMIN_FILIALE (${code})`)
    console.log(`    archiviste.${c}@groupe-gi.com    → ARCHIVISTE (${code})`)
    console.log(`    manager.${c}@groupe-gi.com       → MANAGER (${code})`)
    console.log(`    collab.${c}@groupe-gi.com        → COLLABORATEUR (${code})`)
  }
  console.log()
}

main().catch((e) => { console.error('\n❌ Erreur seed :', e.message ?? e); process.exit(1) })
