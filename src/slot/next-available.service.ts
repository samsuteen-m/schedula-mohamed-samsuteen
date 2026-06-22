import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot, SlotStatus, SlotType } from './slot.entity';
import { Doctor, SchedulingType } from '../doctor/doctor.entity';
import { RecurringAvailability } from '../availability/recurring-availability.entity';
import { CustomAvailability } from '../availability/custom-availability.entity';

interface TimeWindow {
  startTime: string;
  endTime: string;
}

@Injectable()
export class NextAvailableService {
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

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private async hasAvailability(doctorId: string, date: string): Promise<boolean> {
    const dateObj = new Date(date);
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = days[dateObj.getDay()];

    const customAvailability = await this.customRepo.find({
      where: { doctor: { id: doctorId }, date, isActive: true },
    });

    if (customAvailability.length > 0) return true;

    const recurringAvailability = await this.recurringRepo.find({
      where: { doctor: { id: doctorId }, dayOfWeek: dayOfWeek as any, isActive: true },
    });

    return recurringAvailability.length > 0;
  }

  private async getAvailableSlots(doctorId: string, date: string): Promise<Slot[]> {
    const now = new Date();
    const slots = await this.slotRepo.find({
      where: { doctor: { id: doctorId }, date, status: SlotStatus.AVAILABLE },
      order: { startTime: 'ASC' },
    });

    return slots.filter(slot => {
      const slotDateTime = new Date(`${slot.date}T${slot.startTime}`);
      return slotDateTime > now;
    });
  }

  private async getAvailableWaves(doctorId: string, date: string): Promise<Slot[]> {
    const now = new Date();
    const waves = await this.slotRepo.find({
      where: { doctor: { id: doctorId }, date, slotType: SlotType.WAVE },
      order: { startTime: 'ASC' },
    });

    return waves.filter(wave => {
      const waveDateTime = new Date(`${wave.date}T${wave.startTime}`);
      return waveDateTime > now && wave.bookedCount < wave.maxCapacity;
    });
  }

  async findNextAvailableAppointment(doctorId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const today = new Date();
    const todayStr = this.formatDate(today);
    const searchLimit = 30;

    // Check today first
    const todaySlots = doctor.schedulingType === SchedulingType.STREAM
      ? await this.getAvailableSlots(doctorId, todayStr)
      : await this.getAvailableWaves(doctorId, todayStr);

    if (todaySlots.length > 0) {
      return this.formatResponse(doctor, todayStr, todaySlots, true);
    }

    // Search next 30 working days
    for (let i = 1; i <= searchLimit; i++) {
      const searchDate = this.addDays(today, i);
      const searchDateStr = this.formatDate(searchDate);

      const hasAvail = await this.hasAvailability(doctorId, searchDateStr);
      if (!hasAvail) continue;

      const availableSlots = doctor.schedulingType === SchedulingType.STREAM
        ? await this.getAvailableSlots(doctorId, searchDateStr)
        : await this.getAvailableWaves(doctorId, searchDateStr);

      if (availableSlots.length > 0) {
        return this.formatResponse(doctor, searchDateStr, availableSlots, false);
      }
    }

    return {
      message: 'No appointments available in the next 30 working days. Please try again later.',
      doctor: {
        id: doctor.id,
        fullName: doctor.fullName,
        specialization: doctor.specialization,
      },
      nextAvailableDate: null,
      slots: [],
    };
  }

  private formatResponse(
    doctor: Doctor,
    date: string,
    slots: Slot[],
    isToday: boolean,
  ) {
    const dateObj = new Date(date);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[dateObj.getDay()];

    if (doctor.schedulingType === SchedulingType.STREAM) {
      return {
        message: isToday
          ? 'Slots available today! Book now.'
          : `Today is fully booked. Next available date found!`,
        isToday,
        nextAvailableDate: date,
        dayOfWeek: dayName,
        schedulingType: 'STREAM',
        doctor: {
          id: doctor.id,
          fullName: doctor.fullName,
          specialization: doctor.specialization,
          consultationFee: doctor.consultationFee,
        },
        totalAvailableSlots: slots.length,
        slots: slots.map(s => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: `${s.duration} minutes`,
          status: s.status,
        })),
      };
    } else {
      return {
        message: isToday
          ? 'Wave slots available today! Book now.'
          : `Today is fully booked. Next available wave found!`,
        isToday,
        nextAvailableDate: date,
        dayOfWeek: dayName,
        schedulingType: 'WAVE',
        doctor: {
          id: doctor.id,
          fullName: doctor.fullName,
          specialization: doctor.specialization,
          consultationFee: doctor.consultationFee,
        },
        totalAvailableWaves: slots.length,
        waves: slots.map(s => ({
          id: s.id,
          timeWindow: `${s.startTime} - ${s.endTime}`,
          startTime: s.startTime,
          endTime: s.endTime,
          bookedCount: s.bookedCount,
          maxCapacity: s.maxCapacity,
          availableSpots: s.maxCapacity - s.bookedCount,
          capacity: `${s.bookedCount}/${s.maxCapacity}`,
        })),
      };
    }
  }

  async checkTodayAvailability(doctorId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const today = new Date();
    const todayStr = this.formatDate(today);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[today.getDay()];

    const hasAvail = await this.hasAvailability(doctorId, todayStr);
    if (!hasAvail) {
      return {
        message: `Doctor is not available on ${dayName}s`,
        date: todayStr,
        dayOfWeek: dayName,
        isWorkingDay: false,
        slots: [],
      };
    }

    const slots = doctor.schedulingType === SchedulingType.STREAM
      ? await this.getAvailableSlots(doctorId, todayStr)
      : await this.getAvailableWaves(doctorId, todayStr);

    if (slots.length === 0) {
      return {
        message: 'All slots are fully booked for today',
        date: todayStr,
        dayOfWeek: dayName,
        isWorkingDay: true,
        fullyBooked: true,
        schedulingType: doctor.schedulingType,
        slots: [],
        suggestion: 'Use /doctor/:id/next-available to find the next available appointment',
      };
    }

    return this.formatResponse(doctor, todayStr, slots, true);
  }
}