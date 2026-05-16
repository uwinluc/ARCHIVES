import { Module } from '@nestjs/common'
import { PartagesController } from './partages.controller'
import { PartagesService } from './partages.service'

@Module({
  controllers: [PartagesController],
  providers: [PartagesService],
})
export class PartagesModule {}
