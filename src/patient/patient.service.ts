import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';
import { PatientProfileDto } from './patient.dto';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async createProfile(userId: string, dto: PatientProfileDto) {
    const existing = await this.patientRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException('Patient profile already exists');
    }
    const patient = this.patientRepository.create({
      ...dto,
      user: { id: userId },
    });
    await this.patientRepository.save(patient);
    return { message: 'Patient profile created successfully', patient };
  }

  async getProfile(userId: string) {
    const patient = await this.patientRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }
    return patient;
  }

  async updateProfile(userId: string, dto: PatientProfileDto) {
    const patient = await this.patientRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }
    Object.assign(patient, dto);
    await this.patientRepository.save(patient);
    return { message: 'Patient profile updated successfully', patient };
  }
}