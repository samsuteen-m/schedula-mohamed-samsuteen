import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DoctorProfileDto {
  @IsString()
  @IsOptional()
  fullName: string;

  @IsString()
  @IsOptional()
  specialization: string;

  @IsString()
  @IsOptional()
  qualification: string;

  @IsString()
  @IsOptional()
  experience: string;

  @IsString()
  @IsOptional()
  consultationFee: string;

  @IsString()
  @IsOptional()
  consultationHours: string;

  @IsString()
  @IsOptional()
  bio: string;

  @IsString()
  @IsOptional()
  phone: string;

  @IsBoolean()
  @IsOptional()
  isAvailable: boolean;

  // ✅ NEW Day 20 fields
  @IsBoolean()
  @IsOptional()
  allowFutureBooking: boolean;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  @Type(() => Number)
  maxFutureBookingDays: number;
}