import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { Appointment } from '../appointment/appointment.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    NotificationModule,
  ],
  controllers: [ReminderController],
  providers: [ReminderService],
})
export class ReminderModule {}