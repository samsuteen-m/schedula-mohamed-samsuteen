import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { DoctorLeave } from './leave.entity';
import { Doctor } from '../doctor/doctor.entity';
import { Appointment } from '../appointment/appointment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorLeave, Doctor, Appointment])],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}