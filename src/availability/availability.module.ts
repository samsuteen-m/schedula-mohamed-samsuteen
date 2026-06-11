import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { Doctor } from '../doctor/doctor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringAvailability, CustomAvailability, Doctor]),
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}