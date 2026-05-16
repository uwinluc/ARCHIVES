import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import type { Role } from '@gi/shared-types'
import {
  LayoutDashboard, FileText, Search, Share2, FileBarChart,
  Tag, Users, Building2, LucideIcon, ChevronRight,
  Kanban, Calendar, ShieldCheck, Trash2, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface NavItem { to: string; label: string; icon: LucideIcon; minRole: Role }

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard, minRole: 'COLLABORATEUR' },
      { to: '/documents',    label: 'Documents',        icon: FileText,        minRole: 'LECTEUR'       },
      { to: '/recherche',    label: 'Recherche',        icon: Search,          minRole: 'LECTEUR'       },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { to: '/kanban',       label: 'Tableau Kanban',   icon: Kanban,          minRole: 'LECTEUR'       },
      { to: '/calendrier',   label: 'Calendrier',       icon: Calendar,        minRole: 'LECTEUR'       },
      { to: '/conformite',   label: 'Conformité',       icon: ShieldCheck,     minRole: 'ARCHIVISTE'    },
      { to: '/corbeille',    label: 'Corbeille',        icon: Trash2,          minRole: 'COLLABORATEUR' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/partages',     label: 'Partages',         icon: Share2,          minRole: 'ARCHIVISTE'    },
      { to: '/rapports',     label: 'Rapports',         icon: FileBarChart,    minRole: 'ARCHIVISTE'    },
      { to: '/categories',   label: 'Catégories',       icon: Tag,             minRole: 'ADMIN_FILIALE' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/utilisateurs', label: 'Utilisateurs',     icon: Users,           minRole: 'ADMIN_FILIALE' },
      { to: '/filiales',     label: 'Filiales',         icon: Building2,       minRole: 'SUPER_ADMIN'   },
    ],
  },
]

const ROLE_RANK: Record<Role, number> = {
  SUPER_ADMIN: 100, ADMIN_FILIALE: 80, ARCHIVISTE: 60,
  MANAGER: 40, COLLABORATEUR: 20, LECTEUR: 10,
}

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN_FILIALE: 'Admin Filiale',
  ARCHIVISTE: 'Archiviste', MANAGER: 'Manager',
  COLLABORATEUR: 'Collaborateur', LECTEUR: 'Lecteur',
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { profile } = useAuth()
  const location = useLocation()
  if (!profile) return null

  const rank = ROLE_RANK[profile.role]

  return (
    <aside
      className="w-60 shrink-0 flex flex-col h-full min-h-screen"
      style={{ background: 'hsl(var(--sidebar-background))' }}
    >
      {/* ── Brand ──────────────────────────────────────────── */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}>
            <span className="relative z-10">GI</span>
            <div className="absolute inset-0 opacity-30"
              style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)' }} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
              GROUPE GI
            </p>
            <p className="text-[10px] font-medium uppercase tracking-widest mt-0.5"
              style={{ color: 'hsl(var(--sidebar-muted))' }}>
              Archives
            </p>
          </div>
        </div>

        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'hsl(var(--sidebar-muted))' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'hsl(var(--sidebar-accent))'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'hsl(var(--sidebar-muted))' }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        </div>

        {/* Filiale badge */}
        {profile.filialeCode && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.2)',
              color: '#93c5fd',
            }}>
            <Building2 className="w-3 h-3" />
            {profile.filialeCode}
          </div>
        )}
      </div>

      {/* ── Nav ────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => rank >= ROLE_RANK[item.minRole])
          if (!visible.length) return null
          return (
            <div key={group.label}>
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'hsl(var(--sidebar-muted))' }}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item, i) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.to ||
                    (item.to !== '/dashboard' && location.pathname.startsWith(item.to))
                  return (
                    <motion.div
                      key={item.to}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                    >
                      <NavLink to={item.to}>
                        <div className={cn(
                          'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                          isActive
                            ? 'text-white'
                            : 'hover:text-white',
                        )}
                          style={isActive ? {
                            background: 'linear-gradient(90deg, rgba(59,130,246,0.25) 0%, rgba(99,102,241,0.15) 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.2)',
                          } : {
                            color: 'hsl(var(--sidebar-foreground))',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'hsl(var(--sidebar-accent))'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = ''
                            }
                          }}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                              style={{ background: 'hsl(var(--sidebar-primary))' }} />
                          )}
                          <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-blue-400' : '')} />
                          <span className="flex-1">{item.label}</span>
                          {isActive && <ChevronRight className="w-3 h-3 opacity-40" />}
                        </div>
                      </NavLink>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
          style={{ background: 'hsl(var(--sidebar-accent))' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
            {profile.email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
              {profile.email.split('@')[0]}
            </p>
            <p className="text-[10px] truncate" style={{ color: 'hsl(var(--sidebar-muted))' }}>
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
