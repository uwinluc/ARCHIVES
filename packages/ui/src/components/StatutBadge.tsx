import type { StatutDocument } from '@gi/shared-types'
import { Badge } from './Badge'

const config: Record<StatutDocument, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  BROUILLON:            { label: 'Brouillon',         variant: 'default'  },
  SOUMIS:               { label: 'Soumis',            variant: 'info'     },
  REJETE:               { label: 'Rejeté',            variant: 'danger'   },
  VALIDE:               { label: 'Validé',            variant: 'success'  },
  ARCHIVE:              { label: 'Archivé',           variant: 'warning'  },
  A_DETRUIRE:           { label: 'À détruire',        variant: 'danger'   },
  DETRUIT:              { label: 'Détruit',           variant: 'danger'   },
}

export function StatutBadge({ statut }: { statut: StatutDocument }) {
  const { label, variant } = config[statut]
  return <Badge variant={variant}>{label}</Badge>
}
