import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Doctor } from '../doctor/doctor.entity';

export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

export enum SlotType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

@Entity('slots')
export class Slot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor: Doctor;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'int', default: 30 })
  duration: number;

  @Column({ type: 'enum', enum: SlotStatus, default: SlotStatus.AVAILABLE })
  status: SlotStatus;

  @Column({ type: 'enum', enum: SlotType, default: SlotType.STREAM })
  slotType: SlotType;

  @Column({ type: 'int', nullable: true })
  maxCapacity: number;

  @Column({ type: 'int', default: 0 })
  bookedCount: number;

  @Column({ type: 'int', nullable: true })
  bufferTime: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}