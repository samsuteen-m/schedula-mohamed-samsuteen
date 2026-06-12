import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { RecurringAvailability } from './recurring-availability.entity';
import { CustomAvailability } from './custom-availability.entity';
import { RecurringAvailabilityDto, CustomAvailabilityDto, UpdateAvailabilityDto } from './availability.dto';
import { Doctor } from '../doctor/doctor.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
  ) {}

  private isValidTimeRange(startTime: string, endTime: string): boolean {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    return start < end;
  }

  private hasOverlap(
    existingStart: string,
    existingEnd: string,
    newStart: string,
    newEnd: string,
  ): boolean {
    const existStart = new Date(`1970-01-01T${existingStart}`);
    const existEnd = new Date(`1970-01-01T${existingEnd}`);
    const newStartTime = new Date(`1970-01-01T${newStart}`);
    const newEndTime = new Date(`1970-01-01T${newEnd}`);
    return newStartTime < existEnd && newEndTime > existStart;
  }

  async getDoctorByUserId(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found. Please create your profile first');
    }
    return doctor;
  }

  async createRecurring(userId: string, dto: RecurringAvailabilityDto) {
    const doctor = await this.getDoctorByUserId(userId);

    if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
      throw new BadRequestException('End time must be after start time');
    }

    const existing = await this.recurringRepo.find({
      where: { doctor: { id: doctor.id }, dayOfWeek: dto.dayOfWeek, isActive: true },
    });

    // Check duplicate slot
    const duplicate = existing.find(
      slot => slot.startTime === dto.startTime && slot.endTime === dto.endTime,
    );
    if (duplicate) {
      throw new BadRequestException(`Duplicate slot already exists for ${dto.dayOfWeek}`);
    }

    // Check overlap
    for (const slot of existing) {
      if (this.hasOverlap(slot.startTime, slot.endTime, dto.startTime, dto.endTime)) {
        throw new BadRequestException(`Overlapping time slot exists for ${dto.dayOfWeek}`);
      }
    }

    const availability = this.recurringRepo.create({
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      doctor: { id: doctor.id },
    });

    await this.recurringRepo.save(availability);
    return { message: 'Recurring availability created successfully', availability };
  }

  async getRecurring(userId: string) {
    const doctor = await this.getDoctorByUserId(userId);

    const availability = await this.recurringRepo.find({
      where: { doctor: { id: doctor.id } },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });

    if (availability.length === 0) {
      return { message: 'No recurring availability found', data: [] };
    }

    return { data: availability };
  }

  async updateRecurring(userId: string, id: string, dto: UpdateAvailabilityDto) {
    const doctor = await this.getDoctorByUserId(userId);

    const availability = await this.recurringRepo.findOne({
      where: { id, doctor: { id: doctor.id } },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    const newStart = dto.startTime || availability.startTime;
    const newEnd = dto.endTime || availability.endTime;

    if (!this.isValidTimeRange(newStart, newEnd)) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check overlap with other slots (excluding current slot)
    const otherSlots = await this.recurringRepo.find({
      where: {
        doctor: { id: doctor.id },
        dayOfWeek: availability.dayOfWeek,
        isActive: true,
        id: Not(id),
      },
    });

    for (const slot of otherSlots) {
      if (this.hasOverlap(slot.startTime, slot.endTime, newStart, newEnd)) {
        throw new BadRequestException('Updated time overlaps with existing slot');
      }
    }

    // Check duplicate
    const duplicate = otherSlots.find(
      slot => slot.startTime === newStart && slot.endTime === newEnd,
    );
    if (duplicate) {
      throw new BadRequestException('Duplicate slot already exists');
    }

   availability.startTime = newStart;
availability.endTime = newEnd;
if (dto.isActive !== undefined) availability.isActive = dto.isActive;
    await this.recurringRepo.save(availability);
    return { message: 'Availability updated successfully', availability };
  }

  async deleteRecurring(userId: string, id: string) {
    const doctor = await this.getDoctorByUserId(userId);

    const availability = await this.recurringRepo.findOne({
      where: { id, doctor: { id: doctor.id } },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    await this.recurringRepo.remove(availability);
    return { message: 'Availability deleted successfully' };
  }

  async createOverride(userId: string, dto: CustomAvailabilityDto) {
    const doctor = await this.getDoctorByUserId(userId);

    if (!this.isValidTimeRange(dto.startTime, dto.endTime)) {
      throw new BadRequestException('End time must be after start time');
    }

    const dateObj = new Date(dto.date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      throw new BadRequestException('Cannot set availability for past dates');
    }

    const existing = await this.customRepo.find({
      where: { doctor: { id: doctor.id }, date: dto.date },
    });

    // Check duplicate
    const duplicate = existing.find(
      slot => slot.startTime === dto.startTime && slot.endTime === dto.endTime,
    );
    if (duplicate) {
      throw new BadRequestException('Duplicate override slot already exists for this date');
    }

    // Check overlap
    for (const slot of existing) {
      if (this.hasOverlap(slot.startTime, slot.endTime, dto.startTime, dto.endTime)) {
        throw new BadRequestException(`Overlapping time slot exists for ${dto.date}`);
      }
    }

    const override = this.customRepo.create({
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      doctor: { id: doctor.id },
    });

    await this.customRepo.save(override);
    return { message: 'Custom availability created successfully', override };
  }

  async getAvailabilityByDate(userId: string, date: string) {
    const doctor = await this.getDoctorByUserId(userId);

    if (!date) {
      throw new BadRequestException('Date is required');
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const customAvailability = await this.customRepo.find({
      where: { doctor: { id: doctor.id }, date, isActive: true },
      order: { startTime: 'ASC' },
    });

    if (customAvailability.length > 0) {
      return {
        type: 'custom',
        date,
        data: customAvailability,
        message: 'Custom availability for this date',
      };
    }

    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = days[dateObj.getDay()];

    const recurringAvailability = await this.recurringRepo.find({
      where: { doctor: { id: doctor.id }, dayOfWeek: dayOfWeek as any, isActive: true },
      order: { startTime: 'ASC' },
    });

    if (recurringAvailability.length === 0) {
      return {
        type: 'recurring',
        date,
        dayOfWeek,
        data: [],
        message: 'No availability for this date',
      };
    }

    return {
      type: 'recurring',
      date,
      dayOfWeek,
      data: recurringAvailability,
    };
  }
}