import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  specialization: string;

  @Column({ nullable: true })
  qualification: string;

  @Column({ nullable: true })
  experience: string;

  @Column({ nullable: true })
  consultationFee: string;

  @Column({ nullable: true })
  consultationHours: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}