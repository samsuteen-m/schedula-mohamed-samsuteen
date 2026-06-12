import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { DayOfWeek } from './recurring-availability.entity';

export class RecurringAvailabilityDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}

export class CustomAvailabilityDto {
  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}

export class UpdateAvailabilityDto {
  @IsString()
  @IsOptional()
  startTime: string;

  @IsString()
  @IsOptional()
  endTime: string;

  @IsOptional()
  isActive: boolean;
}