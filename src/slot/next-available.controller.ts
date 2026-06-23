import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NextAvailableService } from './next-available.service';

@Controller('doctor')
@UseGuards(AuthGuard('jwt'))
export class NextAvailableController {
  constructor(private nextAvailableService: NextAvailableService) {}

  @Get(':doctorId/today-availability')
  checkTodayAvailability(@Param('doctorId') doctorId: string) {
    return this.nextAvailableService.checkTodayAvailability(doctorId);
  }

  @Get(':doctorId/next-available')
  findNextAvailable(@Param('doctorId') doctorId: string) {
    return this.nextAvailableService.findNextAvailableAppointment(doctorId);
  }
}