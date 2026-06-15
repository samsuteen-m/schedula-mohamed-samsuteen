import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot, SlotStatus } from './slot.entity';
import { Doctor } from '../doctor/doctor.entity';
import { RecurringAvailability } from '../availability/recurring-availability.entity';
import { CustomAvailability } from '../availability/custom-availability.entity';

interface TimeWindow {
  startTime: string;
  endTime: string;
}

@Injectable()
export class SlotService {
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

  private generateTimeSlots(
    startTime: string,
    endTime: string,
    duration: number,
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
      current = slotEnd;
    }
    return slots;
  }

  private isFutureSlot(date: string, startTime: string): boolean {
    const now = new Date();
    const slotDateTime = new Date(`${date}T${startTime}`);
    return slotDateTime > now;
  }

  async generateSlots(userId: string, date: string, duration: number) {
    const doctor = await this.doctorRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      throw new BadRequestException('Cannot generate slots for past dates');
    }

    if (!duration || duration < 10 || duration > 120) {
      throw new BadRequestException('Duration must be between 10 and 120 minutes');
    }

    const customAvailability = await this.customRepo.find({
      where: { doctor: { id: doctor.id }, date, isActive: true },
      order: { startTime: 'ASC' },
    });

    let availabilityWindows: TimeWindow[] = [];

    if (customAvailability.length > 0) {
      availabilityWindows = customAvailability.map(a => ({
        startTime: a.startTime,
        endTime: a.endTime,
      }));
    } else {
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = days[dateObj.getDay()];
      const recurringAvailability = await this.recurringRepo.find({
        where: { doctor: { id: doctor.id }, dayOfWeek: dayOfWeek as any, isActive: true },
        order: { startTime: 'ASC' },
      });
      if (recurringAvailability.length === 0) {
        return { message: 'No availability found for this date', date, slots: [] };
      }
      availabilityWindows = recurringAvailability.map(a => ({
        startTime: a.startTime,
        endTime: a.endTime,
      }));
    }

    const allSlots: TimeWindow[] = [];
    for (const window of availabilityWindows) {
      const timeSlots = this.generateTimeSlots(window.startTime, window.endTime, duration);
      allSlots.push(...timeSlots);
    }

    if (allSlots.length === 0) {
      return { message: 'No slots available for this duration', date, slots: [] };
    }

    await this.slotRepo.delete({
      doctor: { id: doctor.id },
      date,
      status: SlotStatus.AVAILABLE,
    });

    const savedSlots: Slot[] = [];
    for (const slot of allSlots) {
      const newSlot = this.slotRepo.create({
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration,
        status: SlotStatus.AVAILABLE,
        doctor: { id: doctor.id },
      });
      const saved = await this.slotRepo.save(newSlot);
      savedSlots.push(saved);
    }

    return {
      message: `${savedSlots.length} slots generated successfully`,
      date,
      duration: `${duration} minutes`,
      totalSlots: savedSlots.length,
      slots: savedSlots,
    };
  }

  async getAvailableSlots(doctorId: string, date: string) {
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    if (!date) throw new BadRequestException('Date is required');

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const slots = await this.slotRepo.find({
      where: {
        doctor: { id: doctorId },
        date,
        status: SlotStatus.AVAILABLE,
      },
      order: { startTime: 'ASC' },
    });

    const futureSlots = slots.filter(slot =>
      this.isFutureSlot(slot.date, slot.startTime),
    );

    if (futureSlots.length === 0) {
      return {
        message: 'No available slots for this date',
        date,
        doctorId,
        slots: [],
      };
    }

    return {
      date,
      doctorId,
      totalAvailableSlots: futureSlots.length,
      slots: futureSlots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration,
        status: slot.status,
      })),
    };
  }
}