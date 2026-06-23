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

  private checkCutoffTime(date: string, startTime: string): void {
    const appointmentDateTime = new Date(`${date}T${startTime}`);
    const now = new Date();
    const diffMinutes = (appointmentDateTime.getTime() - now.getTime()) / 60000;
    if (diffMinutes < 30) {
      throw new BadRequestException(
        'Cannot modify appointment within 30 minutes of start time',
      );
    }
  }

  private async suggestNextAvailableSlot(
    doctorId: string,
    date: string,
    slotType: SlotType,
  ): Promise<any> {
    const slots = await this.slotRepo.find({
      where: { doctor: { id: doctorId }, slotType },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    const now = new Date();

    if (slotType === SlotType.STREAM) {
      const availableSlot = slots.find(s => {
        const slotDateTime = new Date(`${s.date}T${s.startTime}`);
        return (
          s.status === SlotStatus.AVAILABLE &&
          slotDateTime > now &&
          s.date >= date
        );
      });

      if (availableSlot) {
        return {
          suggested: true,
          message: 'Requested slot unavailable. Here is the next available slot',
          nextSlot: {
            date: availableSlot.date,
            startTime: availableSlot.startTime,
            endTime: availableSlot.endTime,
            slotId: availableSlot.id,
          },
        };
      }
    } else {
      const availableWave = slots.find(s => {
        const slotDateTime = new Date(`${s.date}T${s.startTime}`);
        return (
          s.bookedCount < s.maxCapacity &&
          slotDateTime > now &&
          s.date >= date
        );
      });

      if (availableWave) {
        return {
          suggested: true,
          message: 'Requested wave is full. Here is the next available wave',
          nextWave: {
            date: availableWave.date,
            timeWindow: `${availableWave.startTime} - ${availableWave.endTime}`,
            availableCapacity: availableWave.maxCapacity - availableWave.bookedCount,
            slotId: availableWave.id,
          },
        };
      }
    }

    return null;
  }

  async bookAppointment(patientId: string, dto: BookAppointmentDto) {
    const doctor = await this.doctorRepo.findOne({ where: { id: dto.doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const appointmentDateTime = new Date(`${dto.date}T${dto.startTime}`);
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException('Cannot book appointment for past date or time');
    }

    const slot = await this.slotRepo.findOne({
      where: {
        doctor: { id: dto.doctorId },
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    if (!slot) {
      const suggestion = await this.suggestNextAvailableSlot(dto.doctorId, dto.date, SlotType.STREAM);
      throw new NotFoundException({ message: 'Slot not found', ...(suggestion && { suggestion }) });
    }

    if (slot.slotType === SlotType.WAVE) {
      if (slot.bookedCount >= slot.maxCapacity) {
        const suggestion = await this.suggestNextAvailableSlot(dto.doctorId, dto.date, SlotType.WAVE);
        throw new BadRequestException({
          message: `Wave is full! Maximum capacity of ${slot.maxCapacity} patients reached`,
          ...(suggestion && { suggestion }),
        });
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

      // Send notification
      await this.notificationService.createNotification(
        patientId,
        '🏥 Appointment Booked!',
        `Your WAVE appointment with ${doctor.fullName} is confirmed for ${dto.date} from ${dto.startTime} to ${dto.endTime}. Token Number: ${tokenNumber}`,
        NotificationType.APPOINTMENT_BOOKED,
      );

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

    // Send notification
    await this.notificationService.createNotification(
      patientId,
      '🏥 Appointment Booked!',
      `Your appointment with ${doctor.fullName} is confirmed for ${dto.date} at ${dto.startTime}`,
      NotificationType.APPOINTMENT_BOOKED,
    );

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

    if (
      appointment.date === dto.date &&
      appointment.startTime === dto.startTime &&
      appointment.endTime === dto.endTime
    ) {
      throw new BadRequestException('New slot is the same as the current appointment');
    }

    const newDateTime = new Date(`${dto.date}T${dto.startTime}`);
    if (newDateTime <= new Date()) throw new BadRequestException('Cannot reschedule to past date or time');

    const diffMinutes = (newDateTime.getTime() - new Date().getTime()) / 60000;
    if (diffMinutes < 30) throw new BadRequestException('New slot must be at least 30 minutes from now');

    const newSlot = await this.slotRepo.findOne({
      where: {
        doctor: { id: appointment.doctor.id },
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    if (!newSlot) {
      const suggestion = await this.suggestNextAvailableSlot(
        appointment.doctor.id,
        dto.date,
        appointment.slot?.slotType || SlotType.STREAM,
      );
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

      // Send notification
      await this.notificationService.createNotification(
        patientId,
        '🔄 Appointment Rescheduled',
        `Your appointment has been rescheduled to ${dto.date} from ${dto.startTime} to ${dto.endTime}. New Token: ${tokenNumber}`,
        NotificationType.APPOINTMENT_RESCHEDULED,
      );

      return {
        message: 'Wave appointment rescheduled successfully',
        schedulingType: 'WAVE',
        appointment: {
          id: appointment.id,
          date: appointment.date,
          timeWindow: `${appointment.startTime} - ${appointment.endTime}`,
          tokenNumber,
          status: appointment.status,
        },
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

    // Send notification
    await this.notificationService.createNotification(
      patientId,
      '🔄 Appointment Rescheduled',
      `Your appointment has been rescheduled to ${dto.date} at ${dto.startTime}`,
      NotificationType.APPOINTMENT_RESCHEDULED,
    );

    return {
      message: 'Stream appointment rescheduled successfully',
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

  async getPatientAppointments(patientId: string) {
    const appointments = await this.appointmentRepo.find({
      where: { patient: { id: patientId } },
      relations: ['doctor', 'slot'],
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      return { message: 'No appointments found', data: [] };
    }

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
        doctor: {
          id: apt.doctor?.id,
          fullName: apt.doctor?.fullName,
          specialization: apt.doctor?.specialization,
          consultationFee: apt.doctor?.consultationFee,
        },
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

    // Send notification
    await this.notificationService.createNotification(
      patientId,
      '❌ Appointment Cancelled',
      `Your appointment with ${appointment.doctor?.fullName || 'your doctor'} on ${appointment.date} at ${appointment.startTime} has been cancelled`,
      NotificationType.APPOINTMENT_CANCELLED,
    );

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
      data: appointments
        .filter(apt => apt.patient)
        .map(apt => ({
          id: apt.id,
          date: apt.date,
          startTime: apt.startTime,
          endTime: apt.endTime,
          status: apt.status,
          schedulingType: apt.schedulingType,
          tokenNumber: apt.tokenNumber || null,
          patient: {
            id: apt.patient?.id || null,
            name: apt.patient?.name || null,
            email: apt.patient?.email || null,
          },
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

    // Send notification to patient
    if (appointment.patient) {
      await this.notificationService.createNotification(
        appointment.patient.id,
        '❌ Appointment Cancelled by Doctor',
        `Your appointment with Dr. ${doctor.fullName} on ${appointment.date} at ${appointment.startTime} has been cancelled by the doctor`,
        NotificationType.APPOINTMENT_CANCELLED,
      );
    }

    return { message: 'Appointment cancelled successfully by doctor' };
  }
}