import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { Slot, SlotStatus, SlotType } from '../slot/slot.entity';
import { Doctor } from '../doctor/doctor.entity';
import { BookAppointmentDto, RescheduleAppointmentDto } from './appointment.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    private notificationService: NotificationService,
  ) {}

  private getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  private isValidDate(date: string): boolean {
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }

  private parseTo24Hour(timeStr: string): string | null {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const meridian = match[3]?.toUpperCase();
    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    if (hours < 0 || hours > 23) return null;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  // ✅ Day 20 — main booking date validation (replaces Day 18 & 19 logic)
  private validateBookingDate(date: string, doctor: Doctor): void {
  // ✅ Day 18 — date must be today only
  private validateBookingWindow(date: string): void {
    if (!this.isValidDate(date)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const todayStr = this.getTodayStr();
    const today = new Date(todayStr);
    const bookingDate = new Date(date);

    // Past date — always rejected
    if (date < todayStr) {
      throw new BadRequestException(
        `Booking for past dates is not allowed. Today is ${todayStr}`,
      );
    }

    // Future booking disabled
    if (!doctor.allowFutureBooking) {
      if (date > todayStr) {
        throw new BadRequestException(
          `This doctor only accepts same-day appointments. You can only book for today (${todayStr})`,
        );
      }
      return; // today is fine
    }

    // Future booking enabled — check max days
    const maxDays = doctor.maxFutureBookingDays ?? 7; // default 7 days

    if (maxDays < 1) {
      throw new BadRequestException(
        'Invalid booking configuration. Please contact support.',
      );
    }

    const maxAllowedDate = new Date(today);
    maxAllowedDate.setDate(today.getDate() + maxDays);
    const maxAllowedStr = maxAllowedDate.toISOString().split('T')[0];

    if (bookingDate > maxAllowedDate) {
      throw new BadRequestException(
        `Booking is only allowed up to ${maxDays} day(s) in advance. Latest allowed date is ${maxAllowedStr}`,
      );
    }
  }

  // ✅ Day 19 — time window validation (unchanged)
  private validateBookingTimeWindow(consultationHours: string | null): void {
    if (!consultationHours || !consultationHours.includes('-')) return;

    const [startPart, endPart] = consultationHours.split('-').map(s => s.trim());
    const startTime24 = this.parseTo24Hour(startPart);
    const endTime24 = this.parseTo24Hour(endPart);

    if (!startTime24 || !endTime24) {
      throw new BadRequestException('Doctor consultation timings are invalid.');
    }

    const todayStr = this.getTodayStr();
    const consultationStart = new Date(`${todayStr}T${startTime24}:00`);
    const consultationEnd = new Date(`${todayStr}T${endTime24}:00`);

    if (consultationEnd <= consultationStart) {
      throw new BadRequestException('Invalid consultation timings configured for this doctor.');
    }

    const bookingOpensAt = new Date(consultationStart.getTime() - 2 * 60 * 60 * 1000);
    const bookingClosesAt = new Date(consultationEnd.getTime() - 1 * 60 * 60 * 1000);
    const now = new Date();

    if (now < bookingOpensAt) {
      throw new BadRequestException(
        `Booking window has not opened yet. You can book starting from ${this.formatTime(bookingOpensAt)}.`,
      );
    }

    if (now > bookingClosesAt) {
      throw new BadRequestException(
        `Booking window has closed. Bookings closed at ${this.formatTime(bookingClosesAt)} for today.`,
      );
    }
  }

  // ✅ NEW — Day 19 — time-based booking window
  // Booking opens 2 hours before consultation start, closes 1 hour before consultation end
  private validateBookingTimeWindow(consultationHours: string | null): void {
    if (!consultationHours || !consultationHours.includes('-')) {
      // Doctor hasn't set proper consultation hours — skip time window check gracefully
      return;
    }

    const [startPart, endPart] = consultationHours.split('-').map(s => s.trim());

    const startTime24 = this.parseTo24Hour(startPart);
    const endTime24 = this.parseTo24Hour(endPart);

    if (!startTime24 || !endTime24) {
      throw new BadRequestException(
        'Doctor consultation timings are invalid. Please contact support.',
      );
    }

    const now = new Date();
    const todayStr = this.getTodayStr();

    const consultationStart = new Date(`${todayStr}T${startTime24}:00`);
    const consultationEnd = new Date(`${todayStr}T${endTime24}:00`);

    if (consultationEnd <= consultationStart) {
      throw new BadRequestException(
        'Invalid consultation timings configured for this doctor.',
      );
    }

    const bookingOpensAt = new Date(consultationStart.getTime() - 2 * 60 * 60 * 1000); // 2 hrs before start
    const bookingClosesAt = new Date(consultationEnd.getTime() - 1 * 60 * 60 * 1000); // 1 hr before end

    if (now < bookingOpensAt) {
      throw new BadRequestException(
        `Booking window has not opened yet. You can book starting from ${this.formatTime(bookingOpensAt)}.`,
      );
    }

    if (now > bookingClosesAt) {
      throw new BadRequestException(
        `Booking window has closed. Bookings closed at ${this.formatTime(bookingClosesAt)} for today.`,
      );
    }
  }

  // Converts "9:00 AM" / "09:00" style strings to 24-hour "HH:MM"
  private parseTo24Hour(timeStr: string): string | null {
    if (!timeStr) return null;

    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const meridian = match[3]?.toUpperCase();

    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    if (hours < 0 || hours > 23) return null;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  private checkCutoffTime(date: string, startTime: string): void {
    const appointmentDateTime = new Date(`${date}T${startTime}`);
    const now = new Date();
    const diffMinutes = (appointmentDateTime.getTime() - now.getTime()) / 60000;
    if (diffMinutes < 30) {
      throw new BadRequestException('Cannot modify appointment within 30 minutes of start time');
    }
  }

  private async suggestNextAvailableSlot(doctorId: string, date: string, slotType: SlotType): Promise<any> {
    const slots = await this.slotRepo.find({
      where: { doctor: { id: doctorId }, slotType },
      order: { date: 'ASC', startTime: 'ASC' },
    });
    const now = new Date();
    if (slotType === SlotType.STREAM) {
      const availableSlot = slots.find(s => {
        const slotDateTime = new Date(`${s.date}T${s.startTime}`);
        return s.status === SlotStatus.AVAILABLE && slotDateTime > now && s.date >= date;
      });
      if (availableSlot) {
        return {
          suggested: true,
          message: 'Requested slot unavailable. Here is the next available slot',
          nextSlot: { date: availableSlot.date, startTime: availableSlot.startTime, endTime: availableSlot.endTime, slotId: availableSlot.id },
        };
      }
    } else {
      const availableWave = slots.find(s => {
        const slotDateTime = new Date(`${s.date}T${s.startTime}`);
        return s.bookedCount < s.maxCapacity && slotDateTime > now && s.date >= date;
      });
      if (availableWave) {
        return {
          suggested: true,
          message: 'Requested wave is full. Here is the next available wave',
          nextWave: { date: availableWave.date, timeWindow: `${availableWave.startTime} - ${availableWave.endTime}`, availableCapacity: availableWave.maxCapacity - availableWave.bookedCount, slotId: availableWave.id },
        };
      }
    }
    return null;
  }

  async bookAppointment(patientId: string, dto: BookAppointmentDto) {
    const doctor = await this.doctorRepo.findOne({ where: { id: dto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    // ✅ Day 20 — validate date based on doctor's config
    this.validateBookingDate(dto.date, doctor);

    // ✅ Day 19 — time window check (only applies when booking today)
    if (dto.date === this.getTodayStr()) {
      this.validateBookingTimeWindow(doctor.consultationHours);
    }
    this.validateBookingWindow(dto.date);

    const doctor = await this.doctorRepo.findOne({ where: { id: dto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    // ✅ NEW — time-based booking window check
    this.validateBookingTimeWindow(doctor.consultationHours);

    const appointmentDateTime = new Date(`${dto.date}T${dto.startTime}`);
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException('Cannot book appointment for a past time slot.');
    }

    const slot = await this.slotRepo.findOne({
      where: { doctor: { id: dto.doctorId }, date: dto.date, startTime: dto.startTime, endTime: dto.endTime },
    });

    if (!slot) {
      const suggestion = await this.suggestNextAvailableSlot(dto.doctorId, dto.date, SlotType.STREAM);
      throw new NotFoundException({ message: 'Slot not found', ...(suggestion && { suggestion }) });
    }

    if (slot.slotType === SlotType.WAVE) {
      if (slot.bookedCount >= slot.maxCapacity) {
        const suggestion = await this.suggestNextAvailableSlot(dto.doctorId, dto.date, SlotType.WAVE);
        throw new BadRequestException({ message: `Wave is full! Maximum capacity of ${slot.maxCapacity} patients reached`, ...(suggestion && { suggestion }) });
      }

      const existingWaveBooking = await this.appointmentRepo.findOne({
        where: { patient: { id: patientId }, slot: { id: slot.id }, status: AppointmentStatus.BOOKED },
      });
      if (existingWaveBooking) throw new BadRequestException('You have already booked this wave slot');

      const tokenNumber = slot.bookedCount + 1;
      slot.bookedCount = tokenNumber;
      if (slot.bookedCount >= slot.maxCapacity) slot.status = SlotStatus.BOOKED;
      await this.slotRepo.save(slot);

      const appointment = this.appointmentRepo.create({
        patient: { id: patientId },
        doctor: { id: dto.doctorId },
        slot: { id: slot.id },
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: AppointmentStatus.BOOKED,
        tokenNumber,
        schedulingType: 'WAVE',
      });
      await this.appointmentRepo.save(appointment);

      await this.notificationService.create({
        patientId,
        title: '🏥 Appointment Booked Successfully!',
        message: `Your WAVE appointment with ${doctor.fullName || 'Doctor'} is confirmed for ${dto.date} from ${dto.startTime} to ${dto.endTime}. Your Token Number is ${tokenNumber}.`,
        type: NotificationType.APPOINTMENT_BOOKED,
      });

      return {
        message: 'Wave appointment booked successfully',
        schedulingType: 'WAVE',
        appointment: {
          id: appointment.id,
          date: appointment.date,
          timeWindow: `${appointment.startTime} - ${appointment.endTime}`,
          tokenNumber,
          status: appointment.status,
          waveSummary: `${slot.bookedCount}/${slot.maxCapacity} patients booked`,
        },
      };
    }

    if (slot.status !== SlotStatus.AVAILABLE) {
      const suggestion = await this.suggestNextAvailableSlot(dto.doctorId, dto.date, SlotType.STREAM);
      throw new BadRequestException({ message: 'Slot is already booked', ...(suggestion && { suggestion }) });
    }

    const existing = await this.appointmentRepo.findOne({
      where: { patient: { id: patientId }, slot: { id: slot.id }, status: AppointmentStatus.BOOKED },
    });
    if (existing) throw new BadRequestException('You have already booked this slot');

    slot.status = SlotStatus.BOOKED;
    await this.slotRepo.save(slot);

    const appointment = this.appointmentRepo.create({
      patient: { id: patientId },
      doctor: { id: dto.doctorId },
      slot: { id: slot.id },
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
      schedulingType: 'STREAM',
    });
    await this.appointmentRepo.save(appointment);

    await this.notificationService.create({
      patientId,
      title: '🏥 Appointment Booked Successfully!',
      message: `Your appointment with ${doctor.fullName || 'Doctor'} is confirmed for ${dto.date} at ${dto.startTime}. Please arrive 10 minutes early.`,
      type: NotificationType.APPOINTMENT_BOOKED,
    });

    return {
      message: 'Stream appointment booked successfully',
      schedulingType: 'STREAM',
      appointment: {
        id: appointment.id,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      },
    };
  }

  async rescheduleAppointment(patientId: string, appointmentId: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['patient', 'slot', 'doctor'],
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.patient.id !== patientId) throw new ForbiddenException('You can only reschedule your own appointments');
    if (appointment.status === AppointmentStatus.CANCELLED) throw new BadRequestException('Cannot reschedule a cancelled appointment');

    this.checkCutoffTime(appointment.date, appointment.startTime);

    // ✅ Day 20 — validate new date against doctor's config
    this.validateBookingDate(dto.date, appointment.doctor);

    // ✅ Day 19 — time window only when rescheduling to today
    if (dto.date === this.getTodayStr()) {
      this.validateBookingTimeWindow(appointment.doctor.consultationHours);
    }

    if (appointment.date === dto.date && appointment.startTime === dto.startTime && appointment.endTime === dto.endTime) {
    this.validateBookingWindow(dto.date);

    // ✅ NEW — also enforce time window on reschedule
    this.validateBookingTimeWindow(appointment.doctor.consultationHours);

    if (
      appointment.date === dto.date &&
      appointment.startTime === dto.startTime &&
      appointment.endTime === dto.endTime
    ) {
      throw new BadRequestException('New slot is the same as the current appointment');
    }

    const newDateTime = new Date(`${dto.date}T${dto.startTime}`);
    if (newDateTime <= new Date()) throw new BadRequestException('Cannot reschedule to a past time slot');

    const diffMinutes = (newDateTime.getTime() - new Date().getTime()) / 60000;
    if (diffMinutes < 30) throw new BadRequestException('New slot must be at least 30 minutes from now');

    const newSlot = await this.slotRepo.findOne({
      where: { doctor: { id: appointment.doctor.id }, date: dto.date, startTime: dto.startTime, endTime: dto.endTime },
    });

    if (!newSlot) {
      const suggestion = await this.suggestNextAvailableSlot(appointment.doctor.id, dto.date, appointment.slot?.slotType || SlotType.STREAM);
      throw new NotFoundException({ message: 'New slot not found', ...(suggestion && { suggestion }) });
    }

    if (newSlot.slotType === SlotType.WAVE) {
      if (newSlot.bookedCount >= newSlot.maxCapacity) {
        const suggestion = await this.suggestNextAvailableSlot(appointment.doctor.id, dto.date, SlotType.WAVE);
        throw new BadRequestException({ message: 'Wave is full! Cannot reschedule to this wave', ...(suggestion && { suggestion }) });
      }

      if (appointment.slot) {
        appointment.slot.bookedCount = Math.max(0, appointment.slot.bookedCount - 1);
        if (appointment.slot.bookedCount < appointment.slot.maxCapacity) appointment.slot.status = SlotStatus.AVAILABLE;
        await this.slotRepo.save(appointment.slot);
      }

      const tokenNumber = newSlot.bookedCount + 1;
      newSlot.bookedCount = tokenNumber;
      if (newSlot.bookedCount >= newSlot.maxCapacity) newSlot.status = SlotStatus.BOOKED;
      await this.slotRepo.save(newSlot);

      appointment.date = dto.date;
      appointment.startTime = dto.startTime;
      appointment.endTime = dto.endTime;
      appointment.slot = newSlot;
      appointment.tokenNumber = tokenNumber;
      await this.appointmentRepo.save(appointment);

      await this.notificationService.create({
        patientId,
        title: '🔄 Appointment Rescheduled',
        message: `Your WAVE appointment has been rescheduled to ${dto.date} from ${dto.startTime} to ${dto.endTime}. New Token: ${tokenNumber}.`,
        type: NotificationType.APPOINTMENT_RESCHEDULED,
      });

      return {
        message: 'Wave appointment rescheduled successfully',
        schedulingType: 'WAVE',
        appointment: { id: appointment.id, date: appointment.date, timeWindow: `${appointment.startTime} - ${appointment.endTime}`, tokenNumber, status: appointment.status },
      };
    }

    if (newSlot.status !== SlotStatus.AVAILABLE) {
      const suggestion = await this.suggestNextAvailableSlot(appointment.doctor.id, dto.date, SlotType.STREAM);
      throw new BadRequestException({ message: 'New slot is not available', ...(suggestion && { suggestion }) });
    }

    if (appointment.slot) {
      appointment.slot.status = SlotStatus.AVAILABLE;
      await this.slotRepo.save(appointment.slot);
    }

    newSlot.status = SlotStatus.BOOKED;
    await this.slotRepo.save(newSlot);

    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime = dto.endTime;
    appointment.slot = newSlot;
    await this.appointmentRepo.save(appointment);

    await this.notificationService.create({
      patientId,
      title: '🔄 Appointment Rescheduled',
      message: `Your appointment has been rescheduled to ${dto.date} at ${dto.startTime}.`,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
    });

    return {
      message: 'Stream appointment rescheduled successfully',
      schedulingType: 'STREAM',
      appointment: { id: appointment.id, date: appointment.date, startTime: appointment.startTime, endTime: appointment.endTime, status: appointment.status },
    };
  }

  async getPatientAppointments(patientId: string) {
    const appointments = await this.appointmentRepo.find({
      where: { patient: { id: patientId } },
      relations: ['doctor', 'slot'],
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) return { message: 'No appointments found', data: [] };

    return {
      total: appointments.length,
      data: appointments.map(apt => ({
        id: apt.id,
        date: apt.date,
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        schedulingType: apt.schedulingType,
        tokenNumber: apt.tokenNumber || null,
        doctor: { id: apt.doctor?.id, fullName: apt.doctor?.fullName, specialization: apt.doctor?.specialization, consultationFee: apt.doctor?.consultationFee },
      })),
    };
  }

  async cancelAppointment(patientId: string, appointmentId: string) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['patient', 'slot', 'doctor'],
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.patient.id !== patientId) throw new ForbiddenException('You can only cancel your own appointments');
    if (appointment.status === AppointmentStatus.CANCELLED) throw new BadRequestException('Appointment is already cancelled');

    this.checkCutoffTime(appointment.date, appointment.startTime);

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    if (appointment.slot) {
      if (appointment.slot.slotType === SlotType.WAVE) {
        appointment.slot.bookedCount = Math.max(0, appointment.slot.bookedCount - 1);
        if (appointment.slot.bookedCount < appointment.slot.maxCapacity) appointment.slot.status = SlotStatus.AVAILABLE;
      } else {
        appointment.slot.status = SlotStatus.AVAILABLE;
      }
      await this.slotRepo.save(appointment.slot);
    }

    await this.notificationService.create({
      patientId,
      title: '❌ Appointment Cancelled',
      message: `Your appointment on ${appointment.date} at ${appointment.startTime} with ${appointment.doctor?.fullName || 'your doctor'} has been cancelled.`,
      type: NotificationType.APPOINTMENT_CANCELLED,
    });

    return { message: 'Appointment cancelled successfully' };
  }

  async getDoctorAppointments(userId: string, date?: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: userId } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (date) {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const whereCondition: any = { doctor: { id: doctor.id }, status: AppointmentStatus.BOOKED };
    if (date) whereCondition.date = date;

    const appointments = await this.appointmentRepo.find({
      where: whereCondition,
      relations: ['patient', 'slot'],
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) return { message: 'No appointments found', data: [] };

    return {
      total: appointments.length,
      data: appointments.filter(apt => apt.patient).map(apt => ({
        id: apt.id,
        date: apt.date,
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        schedulingType: apt.schedulingType,
        tokenNumber: apt.tokenNumber || null,
        patient: { id: apt.patient?.id || null, name: apt.patient?.name || null, email: apt.patient?.email || null },
      })),
    };
  }

  async cancelAppointmentByDoctor(userId: string, appointmentId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: userId } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['doctor', 'slot', 'patient'],
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.doctor.id !== doctor.id) throw new ForbiddenException('You can only cancel your own appointments');
    if (appointment.status === AppointmentStatus.CANCELLED) throw new BadRequestException('Appointment is already cancelled');

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    if (appointment.slot) {
      if (appointment.slot.slotType === SlotType.WAVE) {
        appointment.slot.bookedCount = Math.max(0, appointment.slot.bookedCount - 1);
        if (appointment.slot.bookedCount < appointment.slot.maxCapacity) appointment.slot.status = SlotStatus.AVAILABLE;
      } else {
        appointment.slot.status = SlotStatus.AVAILABLE;
      }
      await this.slotRepo.save(appointment.slot);
    }

    if (appointment.patient) {
      await this.notificationService.create({
        patientId: appointment.patient.id,
        title: '❌ Appointment Cancelled by Doctor',
        message: `Your appointment on ${appointment.date} at ${appointment.startTime} has been cancelled by Dr. ${doctor.fullName}. Please rebook at your convenience.`,
        type: NotificationType.APPOINTMENT_CANCELLED,
      });
    }

    return { message: 'Appointment cancelled successfully by doctor' };
  }
}