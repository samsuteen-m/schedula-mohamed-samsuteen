import { IsString, IsDateString, IsUUID } from 'class-validator';

export class BookAppointmentDto {
  @IsUUID()
  doctorId: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}