import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot, SlotStatus, SlotType } from './slot.entity';
import { Doctor, SchedulingType } from '../doctor/doctor.entity';
import { RecurringAvailability } from '../availability/recurring-availability.entity';
import { CustomAvailability } from '../availability/custom-availability.entity';

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

  // FIX 1 — Check if day is a working day (has recurring or custom availability)
  private async isWorkingDay(doctorId: string, date: string): Promise<boolean> {
    const dateObj = new Date(date);
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = days[dateObj.getDay()];

    // Check custom availability first
    const customAvailability = await this.customRepo.find({
      where: { doctor: { id: doctorId }, date, isActive: true },
    });
    if (customAvailability.length > 0) return true;

    // Check recurring availability
    const recurringAvailability = await this.recurringRepo.find({
      where: { doctor: { id: doctorId }, dayOfWeek: dayOfWeek as any, isActive: true },
    });

    return recurringAvailability.length > 0;
  }

  private async getAvailableStreamSlots(doctorId: string, date: string): Promise<Slot[]> {
    const now = new Date();
    const slots = await this.slotRepo.find({
      where: {
        doctor: { id: doctorId },
        date,
        status: SlotStatus.AVAILABLE,
        slotType: SlotType.STREAM,
      },
      order: { startTime: 'ASC' },
    });

    return slots.filter(slot => {
      const slotDateTime = new Date(`${slot.date}T${slot.startTime}`);
      return slotDateTime > now;
    });
  }

  // FIX 2 — WAVE availability now filters by slot status AND remaining capacity
  private async getAvailableWaveSlots(doctorId: string, date: string): Promise<Slot[]> {
    const now = new Date();
    const waves = await this.slotRepo.find({
      where: {
        doctor: { id: doctorId },
        date,
        slotType: SlotType.WAVE,
        status: SlotStatus.AVAILABLE, // ← added status filter
      },
      order: { startTime: 'ASC' },
    });

    return waves.filter(wave => {
      const waveDateTime = new Date(`${wave.date}T${wave.startTime}`);
      return (
        waveDateTime > now &&
        wave.bookedCount < wave.maxCapacity // ← also check capacity
      );
    });
  }

  async findNextAvailableAppointment(doctorId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const today = new Date();
    const todayStr = this.formatDate(today);

    // Check today first
    const todaySlots = doctor.schedulingType === SchedulingType.STREAM
      ? await this.getAvailableStreamSlots(doctorId, todayStr)
      : await this.getAvailableWaveSlots(doctorId, todayStr);

    if (todaySlots.length > 0) {
      return this.formatResponse(doctor, todayStr, todaySlots, true);
    }

    // FIX 1 — Search 30 WORKING days (skip non-working days, don't count them)
    let workingDaysChecked = 0;
    let calendarDaysAhead = 1;
    const maxWorkingDays = 30;

    while (workingDaysChecked < maxWorkingDays) {
      const searchDate = this.addDays(today, calendarDaysAhead);
      const searchDateStr = this.formatDate(searchDate);
      calendarDaysAhead++;

      // Check if this is a working day
      const working = await this.isWorkingDay(doctorId, searchDateStr);
      if (!working) {
        // Skip non-working days but don't count them
        continue;
      }

      // It's a working day — count it
      workingDaysChecked++;

      const availableSlots = doctor.schedulingType === SchedulingType.STREAM
        ? await this.getAvailableStreamSlots(doctorId, searchDateStr)
        : await this.getAvailableWaveSlots(doctorId, searchDateStr);

      if (availableSlots.length > 0) {
        return this.formatResponse(doctor, searchDateStr, availableSlots, false);
      }
    }

    // FIX 3 — Throw proper NotFoundException instead of returning object
    throw new NotFoundException(
      'No appointments available in the next 30 working days. Please try again later.',
    );
  }

  async checkTodayAvailability(doctorId: string) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const today = new Date();
    const todayStr = this.formatDate(today);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[today.getDay()];

    const isWorking = await this.isWorkingDay(doctorId, todayStr);
    if (!isWorking) {
      return {
        message: `Doctor is not available on ${dayName}s`,
        date: todayStr,
        dayOfWeek: dayName,
        isWorkingDay: false,
        slots: [],
      };
    }

    const slots = doctor.schedulingType === SchedulingType.STREAM
      ? await this.getAvailableStreamSlots(doctorId, todayStr)
      : await this.getAvailableWaveSlots(doctorId, todayStr);

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
          : 'Today is fully booked. Next available date found!',
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
          : 'Today is fully booked. Next available wave found!',
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
}