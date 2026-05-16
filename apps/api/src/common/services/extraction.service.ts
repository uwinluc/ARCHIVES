import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name)

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        return await this.extractPdf(buffer)
      }
      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        return await this.extractWord(buffer)
      }
      return ''
    } catch (err) {
      this.logger.warn(`Extraction échouée (${mimeType}): ${(err as Error).message}`)
      return ''
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text?.trim() ?? ''
  }

  private async extractWord(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value?.trim() ?? ''
  }

  generateSnippet(text: string, maxLength = 500): string {
    if (!text) return ''
    return text.slice(0, maxLength).replace(/\s+/g, ' ').trim()
  }
}
