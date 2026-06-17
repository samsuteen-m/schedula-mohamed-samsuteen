import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotService } from './slot.service';
import { SlotController } from './slot.controller';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { Slot } from './slot.entity';
import { Doctor } from '../doctor/doctor.entity';
import { RecurringAvailability } from '../availability/recurring-availability.entity';
import { CustomAvailability } from '../availability/custom-availability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Slot, Doctor, RecurringAvailability, CustomAvailability]),
  ],
  controllers: [SlotController, SchedulingController],
  providers: [SlotService, SchedulingService],
})
export class SlotModule {}