import { Badge } from '../ui/badge'
import type { StatutDocument } from '@gi/shared-types'

const CONFIG: Record<StatutDocument, { label: string; variant: 'slate' | 'info' | 'destructive' | 'success' | 'purple' | 'warning' | 'secondary' }> = {
  BROUILLON:  { label: 'Brouillon',  variant: 'slate'       },
  SOUMIS:     { label: 'Soumis',     variant: 'info'        },
  REJETE:     { label: 'Rejeté',     variant: 'destructive' },
  VALIDE:     { label: 'Validé',     variant: 'success'     },
  ARCHIVE:    { label: 'Archivé',    variant: 'purple'      },
  A_DETRUIRE: { label: 'À détruire', variant: 'warning'     },
  DETRUIT:    { label: 'Détruit',    variant: 'secondary'   },
}

export function StatutBadge({ statut }: { statut: StatutDocument }) {
  const { label, variant } = CONFIG[statut]
  return <Badge variant={variant}>{label}</Badge>
}
