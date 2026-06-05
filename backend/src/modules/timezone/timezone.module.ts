import { Module } from '@nestjs/common';
import { TimeZoneNormalizer } from './timezone-normalizer.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TimeZoneNormalizer],
  exports: [TimeZoneNormalizer],
})
export class TimeZoneModule {}
