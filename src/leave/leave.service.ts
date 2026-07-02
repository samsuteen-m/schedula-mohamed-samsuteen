import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorLeave } from './leave.entity';
import { Doctor } from '../doctor/doctor.entity';
import { Appointment, AppointmentStatus } from '../appointment/appointment.entity';
import { CreateLeaveDto, UpdateLeaveDto } from './leave.dto';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(DoctorLeave)
    private leaveRepo: Repository<DoctorLeave>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
  ) {}

  private getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async getDoctorByUserId(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return doctor;
  }

  async createLeave(userId: string, dto: CreateLeaveDto) {
    const doctor = await this.getDoctorByUserId(userId);

    // Validate date is not in the past
    const todayStr = this.getTodayStr();
    if (dto.leaveDate < todayStr) {
      throw new BadRequestException(
        `Cannot apply leave for past dates. Today is ${todayStr}`,
      );
    }

    // Check duplicate leave
    const existingLeave = await this.leaveRepo.findOne({
      where: { doctor: { id: doctor.id }, leaveDate: dto.leaveDate },
    });
    if (existingLeave) {
      throw new ConflictException(
        `Leave already exists for ${dto.leaveDate}. Cannot create duplicate leave.`,
      );
    }

    // Check if appointments exist on leave date
    const existingAppointments = await this.appointmentRepo.find({
      where: {
        doctor: { id: doctor.id },
        date: dto.leaveDate,
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingAppointments.length > 0) {
      throw new BadRequestException(
        `Cannot apply leave. ${existingAppointments.length} appointment(s) are already scheduled on ${dto.leaveDate}. Please cancel or reschedule existing appointments first.`,
      );
    }

    const leave = this.leaveRepo.create({
      doctor: { id: doctor.id },
      leaveDate: dto.leaveDate,
      reason: dto.reason || 'No reason provided',
    });
    await this.leaveRepo.save(leave);

    return {
      message: `Leave applied successfully for ${dto.leaveDate}`,
      leave: {
        id: leave.id,
        leaveDate: leave.leaveDate,
        reason: leave.reason,
        createdAt: leave.createdAt,
      },
    };
  }

  async getMyLeaves(userId: string) {
    const doctor = await this.getDoctorByUserId(userId);

    const leaves = await this.leaveRepo.find({
      where: { doctor: { id: doctor.id } },
      order: { leaveDate: 'ASC' },
    });

    if (leaves.length === 0) {
      return { message: 'No leaves found', total: 0, data: [] };
    }

    return {
      total: leaves.length,
      data: leaves.map(l => ({
        id: l.id,
        leaveDate: l.leaveDate,
        reason: l.reason,
        createdAt: l.createdAt,
      })),
    };
  }

  async updateLeave(userId: string, leaveId: string, dto: UpdateLeaveDto) {
    const doctor = await this.getDoctorByUserId(userId);

    const leave = await this.leaveRepo.findOne({
      where: { id: leaveId },
      relations: ['doctor'],
    });

    if (!leave) throw new NotFoundException('Leave not found');

    if (leave.doctor.id !== doctor.id) {
      throw new ForbiddenException('You can only update your own leave');
    }

    leave.reason = dto.reason || leave.reason;
    await this.leaveRepo.save(leave);

    return {
      message: 'Leave updated successfully',
      leave: {
        id: leave.id,
        leaveDate: leave.leaveDate,
        reason: leave.reason,
      },
    };
  }

  async deleteLeave(userId: string, leaveId: string) {
    const doctor = await this.getDoctorByUserId(userId);

    const leave = await this.leaveRepo.findOne({
      where: { id: leaveId },
      relations: ['doctor'],
    });

    if (!leave) throw new NotFoundException('Leave not found');

    if (leave.doctor.id !== doctor.id) {
      throw new ForbiddenException('You can only delete your own leave');
    }

    await this.leaveRepo.remove(leave);

    return { message: `Leave for ${leave.leaveDate} deleted successfully` };
  }

  // ✅ Used by AppointmentService to check if doctor is on leave
  async isDoctorOnLeave(doctorId: string, date: string): Promise<boolean> {
    const leave = await this.leaveRepo.findOne({
      where: { doctor: { id: doctorId }, leaveDate: date },
    });
    return !!leave;
  }
}