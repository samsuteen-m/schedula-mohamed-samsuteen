import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReminderService } from './reminder.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reminders')
@UseGuards(AuthGuard('jwt'))
export class ReminderController {
  constructor(private reminderService: ReminderService) {}

  // Doctor or Admin can trigger manual reminder
  @Post('trigger')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR')
  triggerManualReminder() {
    return this.reminderService.triggerManualReminder();
  }

  // Doctor can check reminder status
  @Get('status')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR')
  getReminderStatus() {
    return this.reminderService.getReminderStatus();
  }
}