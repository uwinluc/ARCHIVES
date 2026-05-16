import { useState } from 'react'
import { api } from '../../lib/api'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function monthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function DownloadBtn({
  onClick,
  loading,
  children,
}: {
  onClick: () => void
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {children}
    </button>
  )
}

export function RapportsPage() {
  const [loadingInventaire, setLoadingInventaire] = useState(false)
  const [loadingActivite, setLoadingActivite] = useState(false)
  const [dateFrom, setDateFrom] = useState(monthAgo())
  const [dateTo, setDateTo] = useState(today())

  const handleInventaire = async () => {
    setLoadingInventaire(true)
    try {
      const { data } = await api.get('/rapports/inventaire', { responseType: 'blob' })
      downloadBlob(data as Blob, `inventaire-${today()}.pdf`)
    } finally {
      setLoadingInventaire(false)
    }
  }

  const handleActivite = async () => {
    setLoadingActivite(true)
    try {
      const { data } = await api.get('/rapports/activite', {
        params: { dateFrom, dateTo },
        responseType: 'blob',
      })
      downloadBlob(data as Blob, `activite-${dateFrom}-${dateTo}.pdf`)
    } finally {
      setLoadingActivite(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Rapports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Générer et télécharger des rapports PDF pour votre filiale
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Inventaire */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Inventaire des documents</h2>
              <p className="text-sm text-slate-500 mt-1">
                Liste complète de tous les documents actifs avec leur statut, catégorie et
                date d'expiration. Inclut un résumé statistique par statut.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-600 space-y-1">
            <p>• Tous les documents (hors détruits)</p>
            <p>• Résumé : total par statut</p>
            <p>• Trié par statut puis date de document</p>
            <p>• Maximum 500 documents</p>
          </div>

          <DownloadBtn onClick={handleInventaire} loading={loadingInventaire}>
            Télécharger l'inventaire PDF
          </DownloadBtn>
        </div>

        {/* Activité */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Rapport d'activité</h2>
              <p className="text-sm text-slate-500 mt-1">
                Journal complet des actions (dépôts, validations, partages…) pour une
                période donnée. Inclut un résumé par type d'action.
              </p>
            </div>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Période
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today()}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-600 space-y-1">
            <p>• Tous les événements d'audit de la période</p>
            <p>• Résumé : total par type d'action</p>
            <p>• Trié par date décroissante</p>
            <p>• Maximum 1 000 événements</p>
          </div>

          <DownloadBtn onClick={handleActivite} loading={loadingActivite}>
            Télécharger le rapport PDF
          </DownloadBtn>
        </div>
      </div>
    </div>
  )
}
