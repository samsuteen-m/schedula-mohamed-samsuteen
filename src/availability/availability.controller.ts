import { Controller, Post, Get, Patch, Delete, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AvailabilityService } from './availability.service';
import { RecurringAvailabilityDto, CustomAvailabilityDto, UpdateAvailabilityDto } from './availability.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('doctor/availability')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('DOCTOR')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Post()
  createRecurring(@Request() req, @Body() dto: RecurringAvailabilityDto) {
    return this.availabilityService.createRecurring(req.user.id, dto);
  }

  @Get()
  getRecurring(@Request() req) {
    return this.availabilityService.getRecurring(req.user.id);
  }

  @Patch(':id')
  updateRecurring(@Request() req, @Param('id') id: string, @Body() dto: UpdateAvailabilityDto) {
    return this.availabilityService.updateRecurring(req.user.id, id, dto);
  }

  @Delete(':id')
  deleteRecurring(@Request() req, @Param('id') id: string) {
    return this.availabilityService.deleteRecurring(req.user.id, id);
  }

  @Post('override')
  createOverride(@Request() req, @Body() dto: CustomAvailabilityDto) {
    return this.availabilityService.createOverride(req.user.id, dto);
  }

  @Get('date')
  getByDate(@Request() req, @Query('date') date: string) {
    return this.availabilityService.getAvailabilityByDate(req.user.id, date);
  }
}