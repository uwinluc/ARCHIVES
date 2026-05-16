import { Injectable } from '@nestjs/common'
import PDFDocument = require('pdfkit')
import { PDFDocument as PdfLib, rgb, degrees } from 'pdf-lib'
import { PrismaService } from '../prisma/prisma.service'
import { AuthenticatedUser } from '../auth/auth.types'

type Doc = InstanceType<typeof PDFDocument>

const STATUT_FR: Record<string, string> = {
  BROUILLON: 'Brouillon', SOUMIS: 'Soumis', REJETE: 'Rejeté',
  VALIDE: 'Validé', ARCHIVE: 'Archivé', A_DETRUIRE: 'À détruire', DETRUIT: 'Détruit',
}

const ACTION_FR: Record<string, string> = {
  UPLOAD: 'Dépôt', SOUMISSION: 'Soumission', VALIDATION: 'Validation',
  REJET: 'Rejet', ARCHIVAGE: 'Archivage', PROPOSITION_DESTRUCTION: 'Prop. destruction',
  DESTRUCTION: 'Destruction', TELECHARGEMENT: 'Téléchargement',
  PARTAGE_CREATION: 'Partage créé', PARTAGE_VALIDATION: 'Partage validé',
  PARTAGE_REVOCATION: 'Partage révoqué', NOUVELLE_VERSION: 'Nouvelle version',
}

@Injectable()
export class RapportsService {
  constructor(private readonly prisma: PrismaService) {}

  async addWatermark(pdfBuffer: Buffer, text: string): Promise<Buffer> {
    const doc = await PdfLib.load(pdfBuffer)
    const pages = doc.getPages()
    const font = await doc.embedFont('Helvetica')
    for (const page of pages) {
      const { width, height } = page.getSize()
      page.drawText(text, {
        x: width / 2 - 120,
        y: height / 2,
        size: 48,
        font,
        color: rgb(0.85, 0.85, 0.85),
        rotate: degrees(45),
        opacity: 0.35,
      })
    }
    const bytes = await doc.save()
    return Buffer.from(bytes)
  }

  private buildPdf(fn: (doc: Doc) => void): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      fn(doc)
      doc.end()
    })
  }

  private addHeader(doc: Doc, titre: string, filialeLabel: string, extra?: string) {
    const today = new Date().toLocaleDateString('fr-FR')
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('GROUPE GI', 50, 50)
    doc.fontSize(13).font('Helvetica').fillColor('#334155').text(titre, 50, 72)
    doc.fontSize(9).fillColor('#64748b')
    doc.text(`Filiale : ${filialeLabel}`, 50, 95)
    if (extra) doc.text(extra, 50, 108)
    doc.text(`Généré le : ${today}`, 50, extra ? 121 : 108)
    doc.moveTo(50, extra ? 137 : 124).lineTo(545, extra ? 137 : 124).stroke('#e2e8f0')
    doc.fillColor('#0f172a')
    doc.moveDown(1.5)
  }

  private addTableHeaders(doc: Doc, cols: { label: string; x: number; width: number }[]) {
    const y = doc.y
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b')
    for (const col of cols) {
      doc.text(col.label, col.x, y, { width: col.width, lineBreak: false })
    }
    doc.fillColor('#0f172a')
    doc.moveDown(0.8)
    const lineY = doc.y
    doc.moveTo(50, lineY).lineTo(545, lineY).stroke('#e2e8f0')
    doc.moveDown(0.3)
  }

  private addFooters(doc: Doc) {
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
      doc.text(
        `Page ${i + 1} / ${range.count}  —  Archives GROUPE GI  —  Document confidentiel`,
        50, 800, { align: 'center', width: 495 },
      )
    }
  }

  private truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }

  private fmtDate(d: Date | string | null) {
    return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  }

  private fmtDateTime(d: Date | string) {
    return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  }

  // ── Inventaire ─────────────────────────────────────────────────────────────

  async generateInventaire(user: AuthenticatedUser): Promise<Buffer> {
    const filialeFilter = user.role === 'SUPER_ADMIN' ? {} : { filialeId: user.filialeId! }

    const [docs, filiale] = await Promise.all([
      this.prisma.document.findMany({
        where: { ...filialeFilter, statut: { not: 'DETRUIT' } },
        orderBy: [{ statut: 'asc' }, { dateDocument: 'desc' }],
        include: { categorie: { select: { code: true } } },
        take: 500,
      }),
      user.filialeId
        ? this.prisma.filiale.findUnique({ where: { id: user.filialeId } })
        : null,
    ])

    const filialeLabel = filiale ? `${filiale.code} — ${filiale.nom}` : 'Groupe GI (toutes filiales)'

    // Stats par statut
    const byStatut: Record<string, number> = {}
    for (const d of docs) byStatut[d.statut] = (byStatut[d.statut] ?? 0) + 1

    const cols = [
      { label: 'Titre',      x: 50,  width: 178 },
      { label: 'Catégorie',  x: 233, width: 70  },
      { label: 'Statut',     x: 308, width: 75  },
      { label: 'Date doc.',  x: 388, width: 72  },
      { label: 'Expiration', x: 465, width: 80  },
    ]

    const raw = await this.buildPdf((doc) => {
      this.addHeader(doc, 'Inventaire des documents', filialeLabel)

      // Summary
      doc.fontSize(10).font('Helvetica-Bold').text('Résumé')
      doc.fontSize(9).font('Helvetica')
      doc.text(`Total documents : ${docs.length}`)
      for (const [statut, label] of Object.entries(STATUT_FR)) {
        const count = byStatut[statut] ?? 0
        if (count > 0) doc.text(`  • ${label} : ${count}`)
      }

      doc.moveDown(1)
      doc.fontSize(10).font('Helvetica-Bold').text('Liste des documents')
      doc.moveDown(0.5)
      this.addTableHeaders(doc, cols)

      let rowIndex = 0
      for (const d of docs) {
        if (doc.y > 720) {
          doc.addPage()
          this.addTableHeaders(doc, cols)
        }
        const y = doc.y
        if (rowIndex % 2 === 0) {
          doc.rect(50, y - 2, 495, 14).fill('#f8fafc').stroke('white')
        }
        doc.fontSize(8).font('Helvetica').fillColor('#1e293b')
        doc.text(this.truncate(d.titre, 30), cols[0].x, y, { width: cols[0].width, lineBreak: false })
        doc.text(this.truncate(d.categorie.code, 11), cols[1].x, y, { width: cols[1].width, lineBreak: false })
        doc.text(STATUT_FR[d.statut] ?? d.statut, cols[2].x, y, { width: cols[2].width, lineBreak: false })
        doc.text(this.fmtDate(d.dateDocument), cols[3].x, y, { width: cols[3].width, lineBreak: false })
        doc.text(this.fmtDate(d.dateExpiration), cols[4].x, y, { width: cols[4].width, lineBreak: false })
        doc.moveDown(0.75)
        rowIndex++
      }

      this.addFooters(doc)
    })
    return this.addWatermark(raw, 'CONFIDENTIEL')
  }

  // ── Activité ───────────────────────────────────────────────────────────────

  async generateActivite(user: AuthenticatedUser, dateFrom: string, dateTo: string): Promise<Buffer> {
    const filialeFilter = user.role === 'SUPER_ADMIN' ? {} : { filialeId: user.filialeId! }

    const [logs, filiale] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          ...filialeFilter,
          createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo + 'T23:59:59') },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { prenom: true, nom: true } },
          document: { select: { titre: true } },
        },
        take: 1000,
      }),
      user.filialeId
        ? this.prisma.filiale.findUnique({ where: { id: user.filialeId } })
        : null,
    ])

    const filialeLabel = filiale ? `${filiale.code} — ${filiale.nom}` : 'Groupe GI (toutes filiales)'
    const periodLabel = `${this.fmtDate(dateFrom)} → ${this.fmtDate(dateTo)}`

    const byAction: Record<string, number> = {}
    for (const log of logs) byAction[log.action] = (byAction[log.action] ?? 0) + 1

    const cols = [
      { label: 'Date/heure', x: 50,  width: 90  },
      { label: 'Action',     x: 145, width: 105 },
      { label: 'Document',   x: 255, width: 165 },
      { label: 'Utilisateur',x: 425, width: 120 },
    ]

    const raw = await this.buildPdf((doc) => {
      this.addHeader(doc, "Rapport d'activité", filialeLabel, `Période : ${periodLabel}`)

      // Summary
      doc.fontSize(10).font('Helvetica-Bold').text('Résumé')
      doc.fontSize(9).font('Helvetica').text(`Total événements : ${logs.length}`)
      for (const [action, label] of Object.entries(ACTION_FR)) {
        const count = byAction[action] ?? 0
        if (count > 0) doc.text(`  • ${label} : ${count}`)
      }

      doc.moveDown(1)
      doc.fontSize(10).font('Helvetica-Bold').text('Détail des événements')
      doc.moveDown(0.5)
      this.addTableHeaders(doc, cols)

      let rowIndex = 0
      for (const log of logs) {
        if (doc.y > 720) {
          doc.addPage()
          this.addTableHeaders(doc, cols)
        }
        const y = doc.y
        if (rowIndex % 2 === 0) {
          doc.rect(50, y - 2, 495, 14).fill('#f8fafc').stroke('white')
        }
        doc.fontSize(8).font('Helvetica').fillColor('#1e293b')
        doc.text(this.fmtDateTime(log.createdAt), cols[0].x, y, { width: cols[0].width, lineBreak: false })
        doc.text(this.truncate(ACTION_FR[log.action] ?? log.action, 18), cols[1].x, y, { width: cols[1].width, lineBreak: false })
        doc.text(this.truncate(log.document?.titre ?? '—', 28), cols[2].x, y, { width: cols[2].width, lineBreak: false })
        doc.text(this.truncate(`${log.user.prenom} ${log.user.nom}`, 20), cols[3].x, y, { width: cols[3].width, lineBreak: false })
        doc.moveDown(0.75)
        rowIndex++
      }

      this.addFooters(doc)
    })
    return this.addWatermark(raw, 'CONFIDENTIEL')
  }
}
