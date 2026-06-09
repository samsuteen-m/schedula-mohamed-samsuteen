import { IsString, IsOptional } from 'class-validator';

export class PatientProfileDto {
  @IsString()
  @IsOptional()
  fullName: string;

  @IsString()
  @IsOptional()
  age: string;

  @IsString()
  @IsOptional()
  gender: string;

  @IsString()
  @IsOptional()
  phone: string;

  @IsString()
  @IsOptional()
  address: string;

  @IsString()
  @IsOptional()
  bloodGroup: string;

  @IsString()
  @IsOptional()
  medicalHistory: string;
}