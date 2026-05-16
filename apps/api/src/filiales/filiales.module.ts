import { Module } from '@nestjs/common'
import { FilialessController } from './filiales.controller'
import { FilialessService } from './filiales.service'

@Module({
  controllers: [FilialessController],
  providers: [FilialessService],
})
export class FilialessModule {}
