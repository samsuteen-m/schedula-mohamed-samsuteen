import { Controller, Post, Get, Body, Query, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SchedulingService } from './scheduling.service';
import { SetSchedulingTypeDto, GenerateStreamSlotsDto, GenerateWaveSlotsDto } from './scheduling.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('doctor')
export class SchedulingController {
  constructor(private schedulingService: SchedulingService) {}

  @Post('scheduling-type')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  setSchedulingType(@Request() req, @Body() dto: SetSchedulingTypeDto) {
    return this.schedulingService.setSchedulingType(req.user.id, dto);
  }

  @Post('slots/stream')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  generateStreamSlots(@Request() req, @Body() dto: GenerateStreamSlotsDto) {
    return this.schedulingService.generateStreamSlotsFn(req.user.id, dto);
  }

  @Post('slots/wave')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  generateWaveSlots(@Request() req, @Body() dto: GenerateWaveSlotsDto) {
    return this.schedulingService.generateWaveSlotsFn(req.user.id, dto);
  }

  @Get(':doctorId/slots/scheduled')
  @UseGuards(AuthGuard('jwt'))
  getScheduledSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    if (!date) throw new BadRequestException('Date is required');
    return this.schedulingService.getScheduledSlots(doctorId, date);
  }
}