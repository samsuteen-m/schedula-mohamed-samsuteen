import { Controller, Post, Get, Query, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SlotService } from './slot.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class SlotController {
  constructor(private slotService: SlotService) {}

  // Doctor generates slots
  @Post('doctor/slots/generate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  generateSlots(
    @Request() req,
    @Query('date') date: string,
    @Query('duration') duration: string,
  ) {
    if (!date) throw new BadRequestException('Date is required');
    if (!duration) throw new BadRequestException('Duration is required');
    return this.slotService.generateSlots(req.user.id, date, parseInt(duration));
  }

  // Patient views available slots
  @Get('doctor/:doctorId/slots')
  @UseGuards(AuthGuard('jwt'))
  getAvailableSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    if (!date) throw new BadRequestException('Date is required');
    return this.slotService.getAvailableSlots(doctorId, date);
  }
}