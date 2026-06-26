import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Appointment, AppointmentStatus } from '../appointment/appointment.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { SlotType } from '../slot/slot.entity';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    private notificationService: NotificationService,
  ) {}

  // ✅ Runs every minute — checks for appointments in next 60 minutes
  @Cron(CronExpression.EVERY_MINUTE)
  async sendAppointmentReminders() {
    this.logger.log('⏰ Running appointment reminder check...');

    const now = new Date();
    const reminderWindowEnd = new Date(now.getTime() + 60 * 60 * 1000); // 60 mins from now

    const todayStr = now.toISOString().split('T')[0];

    // Fetch all BOOKED appointments for today that haven't received a reminder
    const appointments = await this.appointmentRepo.find({
      where: {
        date: todayStr,
        status: AppointmentStatus.BOOKED,
        reminderSent: false,
      },
      relations: ['patient', 'doctor', 'slot'],
    });

    if (appointments.length === 0) {
      this.logger.log('✅ No upcoming appointments to remind');
      return;
    }

    let remindersSent = 0;

    for (const appointment of appointments) {
      try {
        const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}`);

        // Check if appointment is within next 60 minutes
        if (appointmentDateTime > now && appointmentDateTime <= reminderWindowEnd) {

          // Skip cancelled or completed
          if (
            appointment.status === AppointmentStatus.CANCELLED ||
            appointment.status === AppointmentStatus.COMPLETED
          ) {
            continue;
          }

          // Skip if no patient linked
          if (!appointment.patient) {
            this.logger.warn(`⚠️ Appointment ${appointment.id} has no patient linked`);
            continue;
          }

          const doctorName = appointment.doctor?.fullName || 'your doctor';
          const appointmentTime = appointment.startTime;
          const appointmentDate = appointment.date;

          let title: string;
          let message: string;

          // Different message for STREAM vs WAVE
          if (appointment.schedulingType === 'WAVE' && appointment.tokenNumber) {
            title = '⏰ Appointment Reminder - Wave';
            message = `Reminder: You have a WAVE appointment with ${doctorName} today.\n\nReporting Time: ${appointmentTime}\nToken Number: ${appointment.tokenNumber}\nDate: ${appointmentDate}\n\nPlease arrive on time!`;
          } else {
            title = '⏰ Appointment Reminder';
            message = `Reminder: You have an appointment with ${doctorName} today.\n\nAppointment Time: ${appointmentTime}\nDate: ${appointmentDate}\n\nPlease arrive 10 minutes early!`;
          }

          // Send notification
          await this.notificationService.create({
            patientId: appointment.patient.id,
            title,
            message,
            type: NotificationType.APPOINTMENT_REMINDER,
          });

          // Mark reminder as sent
          appointment.reminderSent = true;
          await this.appointmentRepo.save(appointment);

          remindersSent++;
          this.logger.log(`✅ Reminder sent for appointment ${appointment.id} - Patient: ${appointment.patient.name}`);
        }
      } catch (e) {
        this.logger.error(`❌ Failed to send reminder for appointment ${appointment.id}: ${e.message}`);
      }
    }

    this.logger.log(`🎯 Reminder check complete. ${remindersSent} reminder(s) sent.`);
  }

  // ✅ Manual trigger for testing — GET /reminders/trigger
  async triggerManualReminder() {
    this.logger.log('🔧 Manual reminder trigger called');
    await this.sendAppointmentReminders();
    return {
      message: 'Reminder check triggered manually',
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ Get reminder status for all today's appointments
  async getReminderStatus() {
    const todayStr = new Date().toISOString().split('T')[0];

    const appointments = await this.appointmentRepo.find({
      where: { date: todayStr },
      relations: ['patient', 'doctor'],
      order: { startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      return {
        message: 'No appointments found for today',
        date: todayStr,
        data: [],
      };
    }

    return {
      date: todayStr,
      total: appointments.length,
      data: appointments.map(apt => ({
        id: apt.id,
        patientName: apt.patient?.name || 'Unknown',
        doctorName: apt.doctor?.fullName || 'Unknown',
        date: apt.date,
        startTime: apt.startTime,
        status: apt.status,
        schedulingType: apt.schedulingType,
        tokenNumber: apt.tokenNumber || null,
        reminderSent: apt.reminderSent,
      })),
    };
  }
}