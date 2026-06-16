import { IsEnum, IsInt, IsString, IsOptional, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { SchedulingType } from '../doctor/doctor.entity';

export class SetSchedulingTypeDto {
  @IsEnum(SchedulingType)
  schedulingType: SchedulingType;
}

export class GenerateStreamSlotsDto {
  @IsDateString()
  date: string;

  @IsInt()
  @Min(10)
  @Max(120)
  @Type(() => Number)
  duration: number;

  @IsInt()
  @Min(0)
  @Max(60)
  @IsOptional()
  @Type(() => Number)
  bufferTime: number;
}

export class GenerateWaveSlotsDto {
  @IsDateString()
  date: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  maxCapacity: number;
}