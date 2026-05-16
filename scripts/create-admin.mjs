import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zwpfancjvqwmrugjhxip.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cGZhbmNqdnF3bXJ1Z2poeGlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2ODk1MywiZXhwIjoyMDkyOTQ0OTUzfQ.Bv6yZr5HtRZtVHeoDKPQ9dlUBfgh4XQMgUrh2Q-TtSk'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const EMAIL = 'admin@groupe-gi.com'
const PASSWORD = 'Admin123!'

// 1. Créer l'utilisateur Supabase Auth
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  app_metadata: { role: 'SUPER_ADMIN', filiale_id: null, filiale_code: null },
})

if (authError) {
  console.error('Erreur création auth:', authError.message)
  process.exit(1)
}

const userId = authData.user.id
console.log('✅ Auth user créé:', userId)

// 2. Créer le User dans Prisma Postgres via l'API
const API_URL = 'http://localhost:3000'

// On utilise directement fetch vers l'API interne (endpoint admin)
// Fallback: créer via Prisma Studio SQL

console.log(`\n✅ Compte créé avec succès !`)
console.log(`   Email    : ${EMAIL}`)
console.log(`   Password : ${PASSWORD}`)
console.log(`   Role     : SUPER_ADMIN`)
console.log(`   Auth ID  : ${userId}`)
console.log(`\n⚠️  Maintenant crée le User en DB via Prisma Studio SQL :`)
console.log(`
INSERT INTO "User" (id, "keycloakId", email, prenom, nom, actif, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '${userId}', '${EMAIL}', 'Super', 'Admin', true, NOW(), NOW());

INSERT INTO "UserRole" (id, "userId", role, "filialeId")
SELECT gen_random_uuid()::text, id, 'SUPER_ADMIN', NULL FROM "User" WHERE email = '${EMAIL}';
`)
