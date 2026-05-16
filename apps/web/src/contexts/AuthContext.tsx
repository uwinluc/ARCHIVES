import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AuthenticatedUser } from '@gi/shared-types'

interface AuthContextValue {
  supabaseUser: User | null
  profile: AuthenticatedUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function extractProfile(user: User): AuthenticatedUser | null {
  const meta = user.app_metadata
  if (!meta?.role) return null
  return {
    id: user.id,
    email: user.email ?? '',
    filialeId: meta.filiale_id ?? null,
    filialeCode: meta.filiale_code ?? null,
    role: meta.role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.refreshSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null
      const extracted = user ? extractProfile(user) : null

      // Token existant mais sans rôle = compte non configuré → déconnexion forcée
      if (user && !extracted) {
        await supabase.auth.signOut()
        setSupabaseUser(null)
        setProfile(null)
      } else {
        setSupabaseUser(user)
        setProfile(extracted)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setSupabaseUser(user)
      setProfile(user ? extractProfile(user) : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    // Vérifie que le compte a un rôle configuré
    if (!data.session?.user?.app_metadata?.role) {
      await supabase.auth.signOut()
      throw new Error('Compte non configuré. Contactez votre administrateur.')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ supabaseUser, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
