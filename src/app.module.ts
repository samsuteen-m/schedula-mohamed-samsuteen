import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AppointmentModule } from './appointment/appointment.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { AvailabilityModule } from './availability/availability.module';
import { SlotModule } from './slot/slot.module';
import { NotificationModule } from './notification/notification.module';
import { User } from './user/user.entity';
import { Doctor } from './doctor/doctor.entity';
import { Patient } from './patient/patient.entity';
import { RecurringAvailability } from './availability/recurring-availability.entity';
import { CustomAvailability } from './availability/custom-availability.entity';
import { Slot } from './slot/slot.entity';
import { Appointment } from './appointment/appointment.entity';
import { Notification } from './notification/notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'schedula',
      entities: [User, Doctor, Patient, RecurringAvailability, CustomAvailability, Slot, Appointment, Notification],
      synchronize: true,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    AppointmentModule,
    DoctorModule,
    PatientModule,
    AvailabilityModule,
    SlotModule,
    NotificationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}