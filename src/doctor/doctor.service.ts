import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from './doctor.entity';
import { DoctorProfileDto } from './doctor.dto';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
  ) {}

  async createProfile(userId: string, dto: DoctorProfileDto) {
    const existing = await this.doctorRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException('Doctor profile already exists');
    }

    const doctor = this.doctorRepository.create({
      ...dto,
      user: { id: userId },
    });
    await this.doctorRepository.save(doctor);
    return { message: 'Doctor profile created successfully', doctor };
  }

  async getProfile(userId: string) {
    const doctor = await this.doctorRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }
    return doctor;
  }

  async updateProfile(userId: string, dto: DoctorProfileDto) {
    const doctor = await this.doctorRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    Object.assign(doctor, dto);
    await this.doctorRepository.save(doctor);
    return { message: 'Doctor profile updated successfully', doctor };
  }
}