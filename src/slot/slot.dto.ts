import { IsDateString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateSlotsDto {
  @IsDateString()
  date: string;

  @IsInt()
  @Min(10)
  @Max(120)
  @Type(() => Number)
  duration: number;
}