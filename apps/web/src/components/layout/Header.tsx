import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import { LogOut, User, ChevronDown, Bell, Sun, Moon, Menu } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Button } from '../ui/button'

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard':    { title: 'Tableau de bord',    sub: "Vue d'ensemble de l'activité"   },
  '/documents':    { title: 'Documents',           sub: 'Gestion et suivi des archives'  },
  '/recherche':    { title: 'Recherche',            sub: 'Recherche plein texte'          },
  '/partages':     { title: 'Partages',             sub: 'Échanges inter-filiales'        },
  '/rapports':     { title: 'Rapports',             sub: 'Analyse et exports'             },
  '/categories':   { title: 'Catégories',           sub: 'Organisation documentaire'      },
  '/utilisateurs': { title: 'Utilisateurs',         sub: 'Gestion des accès'              },
  '/filiales':     { title: 'Filiales',             sub: 'Entités du groupe'              },
  '/kanban':       { title: 'Tableau Kanban',       sub: 'Workflow par statut'            },
  '/corbeille':    { title: 'Corbeille',            sub: 'Documents supprimés'            },
  '/calendrier':   { title: 'Calendrier',           sub: 'Dates de conservation'          },
  '/conformite':   { title: 'Conformité',           sub: 'Tableau de bord réglementaire'  },
}

interface HeaderProps {
  onMenuToggle: () => void
  dark: boolean
  onToggleDark: () => void
}

export function Header({ onMenuToggle, dark, onToggleDark }: HeaderProps) {
  const { profile, signOut } = useAuth()
  const { notifications } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  if (!profile) return null

  const pathKey = '/' + location.pathname.split('/')[1]
  const page = PAGE_TITLES[pathKey] ?? { title: 'Archives', sub: 'GROUPE GI' }
  const initials = profile.email.slice(0, 2).toUpperCase()
  const unreadCount = notifications.length

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
      {/* Hamburger (mobile) + Page title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={onMenuToggle}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-foreground leading-tight truncate">{page.title}</h1>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5 hidden sm:block">{page.sub}</p>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={onToggleDark}
          title={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {dark
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </Button>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : (
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500 opacity-60" />
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-9 px-2.5 hover:bg-accent rounded-lg ml-1"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback
                  className="text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-xs font-semibold text-foreground">
                  {profile.email.split('@')[0]}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {profile.role.replace(/_/g, ' ')}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className="text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold">{profile.email.split('@')[0]}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{profile.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="cursor-pointer gap-2.5">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Mon profil</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2.5" onClick={onToggleDark}>
              {dark
                ? <Sun className="h-4 w-4 text-muted-foreground" />
                : <Moon className="h-4 w-4 text-muted-foreground" />
              }
              <span>{dark ? 'Mode clair' : 'Mode sombre'}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer gap-2.5"
            >
              <LogOut className="h-4 w-4" />
              <span>Se déconnecter</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
