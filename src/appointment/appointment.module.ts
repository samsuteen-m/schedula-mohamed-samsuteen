import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentService } from './appointment.service';
import { AppointmentController, DoctorAppointmentController } from './appointment.controller';
import { Appointment } from './appointment.entity';
import { Slot } from '../slot/slot.entity';
import { Doctor } from '../doctor/doctor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, Slot, Doctor])],
  controllers: [AppointmentController, DoctorAppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule {}