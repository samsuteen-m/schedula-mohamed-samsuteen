import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot, SlotStatus, SlotType } from './slot.entity';
import { Doctor, SchedulingType } from '../doctor/doctor.entity';
import { RecurringAvailability } from '../availability/recurring-availability.entity';
import { CustomAvailability } from '../availability/custom-availability.entity';
import { SetSchedulingTypeDto, GenerateStreamSlotsDto, GenerateWaveSlotsDto } from './scheduling.dto';

interface TimeWindow {
  startTime: string;
  endTime: string;
}

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(Slot)
    private slotRepo: Repository<Slot>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
  ) {}

  private async getDoctorByUserId(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return doctor;
  }

  private async getAvailabilityWindows(doctorId: string, date: string): Promise<TimeWindow[]> {
    const customAvailability = await this.customRepo.find({
      where: { doctor: { id: doctorId }, date, isActive: true },
      order: { startTime: 'ASC' },
    });

    if (customAvailability.length > 0) {
      return customAvailability.map(a => ({ startTime: a.startTime, endTime: a.endTime }));
    }

    const dateObj = new Date(date);
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = days[dateObj.getDay()];

    const recurringAvailability = await this.recurringRepo.find({
      where: { doctor: { id: doctorId }, dayOfWeek: dayOfWeek as any, isActive: true },
      order: { startTime: 'ASC' },
    });

    return recurringAvailability.map(a => ({ startTime: a.startTime, endTime: a.endTime }));
  }

  private generateStreamSlots(
    startTime: string,
    endTime: string,
    duration: number,
    bufferTime: number = 0,
  ): TimeWindow[] {
    const slots: TimeWindow[] = [];
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    let current = new Date(start);

    while (current < end) {
      const slotEnd = new Date(current.getTime() + duration * 60000);
      if (slotEnd > end) break;
      slots.push({
        startTime: current.toTimeString().slice(0, 8),
        endTime: slotEnd.toTimeString().slice(0, 8),
      });
      current = new Date(slotEnd.getTime() + bufferTime * 60000);
    }
    return slots;
  }

  async setSchedulingType(userId: string, dto: SetSchedulingTypeDto) {
    const doctor = await this.getDoctorByUserId(userId);
    doctor.schedulingType = dto.schedulingType;
    await this.doctorRepo.save(doctor);
    return {
      message: `Scheduling type set to ${dto.schedulingType} successfully`,
      schedulingType: dto.schedulingType,
    };
  }

  async generateStreamSlotsFn(userId: string, dto: GenerateStreamSlotsDto) {
    const doctor = await this.getDoctorByUserId(userId);

    if (doctor.schedulingType !== SchedulingType.STREAM) {
      throw new BadRequestException('Doctor is not using STREAM scheduling. Please set scheduling type to STREAM first');
    }

    const dateObj = new Date(dto.date);
    if (isNaN(dateObj.getTime())) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) throw new BadRequestException('Cannot generate slots for past dates');

    if (dto.duration < 10 || dto.duration > 120) throw new BadRequestException('Duration must be between 10 and 120 minutes');
    if (dto.bufferTime && (dto.bufferTime < 0 || dto.bufferTime > 60)) throw new BadRequestException('Buffer time must be between 0 and 60 minutes');

    const availabilityWindows = await this.getAvailabilityWindows(doctor.id, dto.date);
    if (availabilityWindows.length === 0) {
      return { message: 'No availability found for this date', date: dto.date, slots: [] };
    }

    const allSlots: TimeWindow[] = [];
    for (const window of availabilityWindows) {
      const timeSlots = this.generateStreamSlots(window.startTime, window.endTime, dto.duration, dto.bufferTime || 0);
      allSlots.push(...timeSlots);
    }

    if (allSlots.length === 0) {
      return { message: 'No slots can be generated with given duration', date: dto.date, slots: [] };
    }

    await this.slotRepo.delete({ doctor: { id: doctor.id }, date: dto.date, status: SlotStatus.AVAILABLE, slotType: SlotType.STREAM });

    const savedSlots: Slot[] = [];
    for (const slot of allSlots) {
      const newSlot = this.slotRepo.create({
        date: dto.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: dto.duration,
        bufferTime: dto.bufferTime || 0,
        status: SlotStatus.AVAILABLE,
        slotType: SlotType.STREAM,
        maxCapacity: 1,
        bookedCount: 0,
        doctor: { id: doctor.id },
      });
      const saved = await this.slotRepo.save(newSlot);
      savedSlots.push(saved);
    }

    return {
      message: `${savedSlots.length} STREAM slots generated successfully`,
      schedulingType: 'STREAM',
      date: dto.date,
      duration: `${dto.duration} minutes`,
      bufferTime: `${dto.bufferTime || 0} minutes`,
      totalSlots: savedSlots.length,
      slots: savedSlots.map(s => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
      })),
    };
  }

  async generateWaveSlotsFn(userId: string, dto: GenerateWaveSlotsDto) {
    const doctor = await this.getDoctorByUserId(userId);

    if (doctor.schedulingType !== SchedulingType.WAVE) {
      throw new BadRequestException('Doctor is not using WAVE scheduling. Please set scheduling type to WAVE first');
    }

    const dateObj = new Date(dto.date);
    if (isNaN(dateObj.getTime())) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) throw new BadRequestException('Cannot generate slots for past dates');

    if (dto.maxCapacity < 1 || dto.maxCapacity > 50) throw new BadRequestException('Max capacity must be between 1 and 50');

    const availabilityWindows = await this.getAvailabilityWindows(doctor.id, dto.date);
    if (availabilityWindows.length === 0) {
      return { message: 'No availability found for this date', date: dto.date, slots: [] };
    }

    await this.slotRepo.delete({ doctor: { id: doctor.id }, date: dto.date, status: SlotStatus.AVAILABLE, slotType: SlotType.WAVE });

    const savedSlots: Slot[] = [];
    for (const window of availabilityWindows) {
      const newSlot = this.slotRepo.create({
        date: dto.date,
        startTime: window.startTime,
        endTime: window.endTime,
        duration: 0,
        status: SlotStatus.AVAILABLE,
        slotType: SlotType.WAVE,
        maxCapacity: dto.maxCapacity,
        bookedCount: 0,
        doctor: { id: doctor.id },
      });
      const saved = await this.slotRepo.save(newSlot);
      savedSlots.push(saved);
    }

    return {
      message: `${savedSlots.length} WAVE slot(s) generated successfully`,
      schedulingType: 'WAVE',
      date: dto.date,
      maxCapacity: dto.maxCapacity,
      totalWaves: savedSlots.length,
      waves: savedSlots.map(s => ({
        id: s.id,
        timeWindow: `${s.startTime} - ${s.endTime}`,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: `0/${s.maxCapacity}`,
        status: s.status,
      })),
    };
  }

  async getScheduledSlots(doctorId: string, date: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (!date) throw new BadRequestException('Date is required');

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');

    const slots = await this.slotRepo.find({
      where: { doctor: { id: doctorId }, date, status: SlotStatus.AVAILABLE },
      order: { startTime: 'ASC' },
    });

    const now = new Date();
    const futureSlots = slots.filter(slot => {
      const slotDateTime = new Date(`${slot.date}T${slot.startTime}`);
      return slotDateTime > now;
    });

    if (futureSlots.length === 0) {
      return { message: 'No available slots for this date', date, slots: [] };
    }

    if (doctor.schedulingType === SchedulingType.STREAM) {
      return {
        schedulingType: 'STREAM',
        date,
        message: 'Exact appointment times available',
        totalSlots: futureSlots.length,
        slots: futureSlots.map(s => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: `${s.duration} minutes`,
          status: s.status,
        })),
      };
    } else {
      return {
        schedulingType: 'WAVE',
        date,
        message: 'Token-based appointment windows available',
        totalWaves: futureSlots.length,
        waves: futureSlots.map(s => ({
          id: s.id,
          timeWindow: `${s.startTime} - ${s.endTime}`,
          available: `${s.bookedCount}/${s.maxCapacity}`,
          remainingSlots: s.maxCapacity - s.bookedCount,
          status: s.bookedCount >= s.maxCapacity ? 'FULL' : 'AVAILABLE',
        })),
      };
    }
  }
}