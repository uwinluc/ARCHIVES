import { Global, Module } from '@nestjs/common'
import { AuditService } from './services/audit.service'
import { StorageService } from './services/storage.service'
import { SupabaseAdminService } from './services/supabase-admin.service'
import { SearchService } from './services/search.service'
import { EmailService } from './services/email.service'
import { SchedulerService } from './services/scheduler.service'
import { ExtractionService } from './services/extraction.service'

@Global()
@Module({
  providers: [AuditService, StorageService, SupabaseAdminService, SearchService, EmailService, SchedulerService, ExtractionService],
  exports: [AuditService, StorageService, SupabaseAdminService, SearchService, EmailService, ExtractionService],
})
export class CommonModule {}
