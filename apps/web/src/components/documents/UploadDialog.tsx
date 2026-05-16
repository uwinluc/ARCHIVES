import { FormEvent, useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, FileImage, Archive, X, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { useDocumentMutation } from '../../hooks/useDocuments'
import { useCategories } from '../../hooks/useCategories'
import { TiptapEditor } from '../editor/TiptapEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'

interface Props { onClose: () => void }

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/tiff': ['.tiff'],
  'application/zip': ['.zip'],
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function FileIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn('w-8 h-8', className)
  if (type === 'application/pdf') return <FileText className={cls} />
  if (type.startsWith('image/')) return <FileImage className={cls} />
  if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className={cls} />
  if (type === 'application/zip') return <Archive className={cls} />
  return <FileText className={cls} />
}

export function UploadDialog({ onClose }: Props) {
  const { data: categories = [] } = useCategories()
  const { upload } = useDocumentMutation()
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [titre, setTitre] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [dateDocument, setDateDocument] = useState(new Date().toISOString().split('T')[0])
  const [confidentialite, setConfidentialite] = useState('INTERNE')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length) { setError('Fichier refusé : format non supporté ou trop volumineux.'); return }
    const file = accepted[0]
    if (!file) return
    setDroppedFile(file)
    if (!titre) setTitre(file.name.replace(/\.[^.]+$/, ''))
    setError(null)
  }, [titre])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false, maxSize: 50 * 1024 * 1024, accept: ACCEPTED_TYPES,
  })

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!droppedFile) { setError('Sélectionnez un fichier.'); return }
    const fd = new FormData()
    fd.set('file', droppedFile)
    fd.set('titre', titre)
    fd.set('categorieId', categorieId)
    fd.set('dateDocument', dateDocument)
    fd.set('confidentialite', confidentialite)
    if (description) fd.set('description', description)
    if (tags) fd.set('tags', tags)
    try {
      await upload.mutateAsync(fd)
      onClose()
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message
      setError(msg ?? "Erreur lors de l'envoi.")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>Nouveau document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200',
              isDragActive
                ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                : droppedFile
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50',
            )}
          >
            <input {...getInputProps()} />
            <AnimatePresence mode="wait">
              {droppedFile ? (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center gap-2"
                >
                  <FileIcon type={droppedFile.type} className="text-green-500" />
                  <p className="text-sm font-semibold text-foreground">{droppedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(droppedFile.size)}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDroppedFile(null) }}
                    className="text-xs text-destructive hover:text-destructive/80 mt-1 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Changer de fichier
                  </button>
                </motion.div>
              ) : isDragActive ? (
                <motion.div key="drag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-blue-500 animate-bounce" />
                  <p className="text-sm font-medium text-blue-600">Déposez le fichier ici</p>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">Glissez-déposez votre fichier</p>
                  <p className="text-xs text-muted-foreground">ou cliquez pour sélectionner</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">PDF, Word, Excel, Image, ZIP — max 50 Mo</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Titre */}
          <div className="space-y-1.5">
            <Label htmlFor="titre">Titre <span className="text-destructive">*</span></Label>
            <Input
              id="titre"
              required
              maxLength={255}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Nom du document"
            />
          </div>

          {/* Catégorie + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="categorie">Catégorie <span className="text-destructive">*</span></Label>
              <select
                id="categorie"
                required
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Choisir…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
              <Input
                id="date"
                type="date"
                required
                value={dateDocument}
                onChange={(e) => setDateDocument(e.target.value)}
              />
            </div>
          </div>

          {/* Confidentialité */}
          <div className="space-y-1.5">
            <Label htmlFor="confidentialite">Confidentialité <span className="text-destructive">*</span></Label>
            <select
              id="confidentialite"
              required
              value={confidentialite}
              onChange={(e) => setConfidentialite(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="INTERNE">Interne</option>
              <option value="PUBLIC">Public</option>
              <option value="CONFIDENTIEL">Confidentiel</option>
              <option value="SECRET">Secret</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <TiptapEditor value={description} onChange={setDescription} placeholder="Optionnel" />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="contrat, fournisseur, 2026 (séparés par des virgules)"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
              ) : (
                <><Upload className="w-4 h-4" /> Déposer</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
