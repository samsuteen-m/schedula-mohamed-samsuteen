import { IsString, IsOptional, IsBoolean } from 'class-validator';

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
}