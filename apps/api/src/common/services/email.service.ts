import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly transporter: nodemailer.Transporter
  private readonly from: string
  private readonly enabled: boolean

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const host = config.get<string>('SMTP_HOST')
    this.enabled = !!host
    this.from = config.get<string>('SMTP_FROM', 'noreply@groupe-gi.com')

    this.transporter = nodemailer.createTransport({
      host: host ?? 'localhost',
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<string>('SMTP_SECURE') === 'true',
      auth: config.get('SMTP_USER')
        ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
        : undefined,
    })
  }

  private async send(to: string | string[], subject: string, html: string): Promise<void> {
    if (!this.enabled) return
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html })
    } catch (err) {
      this.logger.error(`Échec envoi email "${subject}": ${(err as Error).message}`)
    }
  }

  private async findUsersWithRoles(filialeId: string, roles: string[]) {
    return this.prisma.user.findMany({
      where: {
        filialeId,
        actif: true,
        roles: { some: { role: { in: roles as any[] } } },
      },
      select: { email: true, prenom: true, nom: true },
    })
  }

  async notifierSoumission(documentTitre: string, filialeId: string): Promise<void> {
    const recipients = await this.findUsersWithRoles(filialeId, ['ARCHIVISTE', 'MANAGER', 'ADMIN_FILIALE'])
    if (!recipients.length) return

    const html = `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Document soumis pour validation</h2>
        <p>Un nouveau document est en attente de validation :</p>
        <p style="background:#f1f5f9;padding:12px;border-radius:6px">
          <strong>${documentTitre}</strong>
        </p>
        <p>Connectez-vous à la plateforme pour valider ou rejeter ce document.</p>
      </div>`

    await this.send(
      recipients.map((r: { email: string }) => r.email),
      `[Archives GI] Document soumis : ${documentTitre}`,
      html,
    )
  }

  async notifierValidation(auteurEmail: string, auteurPrenom: string, documentTitre: string): Promise<void> {
    const html = `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#16a34a">Document validé ✓</h2>
        <p>Bonjour ${auteurPrenom},</p>
        <p>Votre document <strong>${documentTitre}</strong> a été validé et est désormais officiel.</p>
      </div>`

    await this.send(auteurEmail, `[Archives GI] Document validé : ${documentTitre}`, html)
  }

  async notifierRejet(
    auteurEmail: string,
    auteurPrenom: string,
    documentTitre: string,
    motif: string,
  ): Promise<void> {
    const html = `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#dc2626">Document rejeté</h2>
        <p>Bonjour ${auteurPrenom},</p>
        <p>Votre document <strong>${documentTitre}</strong> a été rejeté.</p>
        <p><strong>Motif :</strong></p>
        <p style="background:#fef2f2;padding:12px;border-radius:6px;border-left:4px solid #dc2626">
          ${motif}
        </p>
        <p>Vous pouvez corriger le document et le soumettre à nouveau.</p>
      </div>`

    await this.send(auteurEmail, `[Archives GI] Document rejeté : ${documentTitre}`, html)
  }

  async notifierPropositionDestruction(
    documentTitre: string,
    filialeId: string,
    justification: string,
  ): Promise<void> {
    const recipients = await this.findUsersWithRoles(filialeId, ['ADMIN_FILIALE'])
    if (!recipients.length) return

    const html = `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#ea580c">Destruction à confirmer</h2>
        <p>Un document est en attente de destruction définitive :</p>
        <p style="background:#fff7ed;padding:12px;border-radius:6px;border-left:4px solid #ea580c">
          <strong>${documentTitre}</strong><br/>
          <em>Justification :</em> ${justification}
        </p>
        <p>Connectez-vous pour confirmer ou refuser la destruction. La double validation est requise.</p>
      </div>`

    await this.send(
      recipients.map((r: { email: string }) => r.email),
      `[Archives GI] Destruction à confirmer : ${documentTitre}`,
      html,
    )
  }

  async notifierExpirationProche(
    documentTitre: string,
    dateExpiration: Date,
    auteurEmail: string,
    filialeId: string,
    joursRestants: number,
  ): Promise<void> {
    const dateStr = dateExpiration.toLocaleDateString('fr-FR')
    const archivistes = await this.findUsersWithRoles(filialeId, ['ARCHIVISTE', 'ADMIN_FILIALE'])
    const emails = [...new Set([auteurEmail, ...archivistes.map((a: { email: string }) => a.email)])]

    const color = joursRestants <= 7 ? '#dc2626' : joursRestants <= 30 ? '#ea580c' : '#1e40af'
    const html = `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:${color}">Document expirant dans ${joursRestants} jour(s)</h2>
        <p>Le document suivant arrive à expiration le <strong>${dateStr}</strong> :</p>
        <p style="background:#f1f5f9;padding:12px;border-radius:6px">
          <strong>${documentTitre}</strong>
        </p>
        <p>Pensez à archiver ou renouveler ce document avant sa date d'expiration.</p>
      </div>`

    await this.send(emails, `[Archives GI] Expiration dans ${joursRestants} j : ${documentTitre}`, html)
  }
}
