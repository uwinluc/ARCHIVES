import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  url: string
  onClose: () => void
}

export function PdfViewer({ url, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    pdfjsLib.getDocument(url).promise.then((doc) => {
      if (cancelled) return
      setPdf(doc)
      setNumPages(doc.numPages)
      setLoading(false)
    }).catch((err) => {
      if (cancelled) return
      setError(`Impossible de charger le PDF: ${err.message}`)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [url])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (renderTaskRef.current) renderTaskRef.current.cancel()

    pdf.getPage(pageNum).then((page) => {
      const viewport = page.getViewport({ scale })
      canvas.height = viewport.height
      canvas.width = viewport.width
      const task = page.render({ canvasContext: ctx, viewport, canvas })
      renderTaskRef.current = task
      return task.promise
    }).catch((err) => {
      if (err.name !== 'RenderingCancelledException') {
        setError(`Erreur de rendu: ${err.message}`)
      }
    })
  }, [pdf, pageNum, scale])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
        <button
          onClick={onClose}
          className="text-slate-300 hover:text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-700 transition-colors"
        >
          ← Fermer
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="px-2.5 py-1 rounded text-sm text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-slate-300">
            {pageNum} / {numPages}
          </span>
          <button
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="px-2.5 py-1 rounded text-sm text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-2.5 py-1 rounded text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            −
          </button>
          <span className="text-xs text-slate-400 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-2.5 py-1 rounded text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-start justify-center py-6 px-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 mt-20">
            <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Chargement du PDF…
          </div>
        )}
        {error && (
          <div className="text-red-400 bg-red-900/20 rounded-xl px-6 py-4 mt-20 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="shadow-2xl rounded bg-white"
          />
        )}
      </div>
    </div>
  )
}
