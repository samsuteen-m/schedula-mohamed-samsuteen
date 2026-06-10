import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
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

  async getAllDoctors(query: any) {
    const { specialization, search, page, limit, availability } = query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;

    if (pageNum < 1 || limitNum < 1) {
      throw new BadRequestException('Page and limit must be positive numbers');
    }

    const skip = (pageNum - 1) * limitNum;
    const whereConditions: any = {};

    if (specialization) {
      whereConditions.specialization = Like(`%${specialization}%`);
    }
    if (search) {
      whereConditions.fullName = Like(`%${search}%`);
    }
    if (availability !== undefined) {
      whereConditions.isAvailable = availability === 'true';
    }

    const [doctors, total] = await this.doctorRepository.findAndCount({
      where: whereConditions,
      skip,
      take: limitNum,
      select: ['id', 'fullName', 'specialization', 'experience', 'consultationFee', 'isAvailable'],
    });

    if (doctors.length === 0) {
      return { message: 'No doctors found', data: [], total: 0, page: pageNum, limit: limitNum };
    }

    return { data: doctors, total, page: pageNum, limit: limitNum };
  }

  async getDoctorById(id: string) {
    if (!id) {
      throw new BadRequestException('Invalid doctor ID');
    }
    const doctor = await this.doctorRepository.findOne({ where: { id } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    return doctor;
  }
}