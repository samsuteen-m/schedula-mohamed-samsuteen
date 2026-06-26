import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentService } from './appointment.service';
import { AppointmentController, DoctorAppointmentController } from './appointment.controller';
import { Appointment } from './appointment.entity';
import { Slot } from '../slot/slot.entity';
import { Doctor } from '../doctor/doctor.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, Slot, Doctor]),
    NotificationModule,
  ],
  controllers: [AppointmentController, DoctorAppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule {}