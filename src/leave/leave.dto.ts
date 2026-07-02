import { IsDateString, IsString, IsOptional } from 'class-validator';

export class CreateLeaveDto {
  @IsDateString()
  leaveDate: string;

  @IsString()
  @IsOptional()
  reason: string;
}

export class UpdateLeaveDto {
  @IsString()
  @IsOptional()
  reason: string;
}