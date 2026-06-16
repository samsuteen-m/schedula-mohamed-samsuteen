import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { Slot, SlotStatus, SlotType } from '../slot/slot.entity';
import { Doctor } from '../doctor/doctor.entity';
import { BookAppointmentDto } from './appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
  ) {}

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
    if (!slot) throw new NotFoundException('Slot not found');

    // Handle WAVE booking
    if (slot.slotType === SlotType.WAVE) {
      if (slot.bookedCount >= slot.maxCapacity) {
        throw new BadRequestException(`Wave is full! Maximum capacity of ${slot.maxCapacity} patients reached`);
      }

      const existingWaveBooking = await this.appointmentRepo.findOne({
        where: {
          patient: { id: patientId },
          slot: { id: slot.id },
          status: AppointmentStatus.BOOKED,
        },
      });
      if (existingWaveBooking) {
        throw new BadRequestException('You have already booked this wave slot');
      }

      const tokenNumber = slot.bookedCount + 1;
      slot.bookedCount = tokenNumber;

      if (slot.bookedCount >= slot.maxCapacity) {
        slot.status = SlotStatus.BOOKED;
      }
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

    // Handle STREAM booking
    if (slot.status !== SlotStatus.AVAILABLE) {
      throw new BadRequestException('Slot is already booked');
    }

    const existing = await this.appointmentRepo.findOne({
      where: {
        patient: { id: patientId },
        slot: { id: slot.id },
        status: AppointmentStatus.BOOKED,
      },
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
      relations: ['patient', 'slot'],
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    if (appointment.patient.id !== patientId) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}`);
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException('Cannot cancel past appointment');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    if (appointment.slot) {
      if (appointment.slot.slotType === SlotType.WAVE) {
        appointment.slot.bookedCount = Math.max(0, appointment.slot.bookedCount - 1);
        if (appointment.slot.bookedCount < appointment.slot.maxCapacity) {
          appointment.slot.status = SlotStatus.AVAILABLE;
        }
      } else {
        appointment.slot.status = SlotStatus.AVAILABLE;
      }
      await this.slotRepo.save(appointment.slot);
    }

    return { message: 'Appointment cancelled successfully' };
  }

  async getDoctorAppointments(userId: string) {
    const doctor = await this.doctorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const appointments = await this.appointmentRepo.find({
      where: { doctor: { id: doctor.id } },
      relations: ['patient', 'slot'],
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
        patient: {
          id: apt.patient?.id,
          name: apt.patient?.name,
          email: apt.patient?.email,
        },
      })),
    };
  }
}