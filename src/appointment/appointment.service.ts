import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { Slot, SlotStatus } from '../slot/slot.entity';
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
    // Check doctor exists
    const doctor = await this.doctorRepo.findOne({
      where: { id: dto.doctorId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    // Check future date
    const appointmentDateTime = new Date(`${dto.date}T${dto.startTime}`);
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException('Cannot book appointment for past date or time');
    }

    // Find the slot
    const slot = await this.slotRepo.findOne({
      where: {
        doctor: { id: dto.doctorId },
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
    if (!slot) throw new NotFoundException('Slot not found');

    // Check slot is available
    if (slot.status !== SlotStatus.AVAILABLE) {
      throw new BadRequestException('Slot is already booked');
    }

    // Check duplicate booking
    const existing = await this.appointmentRepo.findOne({
      where: {
        patient: { id: patientId },
        slot: { id: slot.id },
        status: AppointmentStatus.BOOKED,
      },
    });
    if (existing) throw new BadRequestException('You have already booked this slot');

    // Create appointment
    const appointment = this.appointmentRepo.create({
      patient: { id: patientId },
      doctor: { id: dto.doctorId },
      slot: { id: slot.id },
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
    });
    await this.appointmentRepo.save(appointment);

    // Mark slot as booked
    slot.status = SlotStatus.BOOKED;
    await this.slotRepo.save(slot);

    return {
      message: 'Appointment booked successfully',
      appointment,
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

    // Check ownership
    if (appointment.patient.id !== patientId) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    // Check already cancelled
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    // Check past appointment
    const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}`);
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException('Cannot cancel past appointment');
    }

    // Cancel appointment
    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    // Free up the slot
    if (appointment.slot) {
      appointment.slot.status = SlotStatus.AVAILABLE;
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
        patient: {
          id: apt.patient?.id,
          name: apt.patient?.name,
          email: apt.patient?.email,
        },
      })),
    };
  }
}