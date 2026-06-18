import { Controller, Post, Get, Patch, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentService } from './appointment.service';
import { BookAppointmentDto, RescheduleAppointmentDto } from './appointment.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('appointment')
@UseGuards(AuthGuard('jwt'))
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  bookAppointment(@Request() req, @Body() dto: BookAppointmentDto) {
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  getMyAppointments(@Request() req) {
    return this.appointmentService.getPatientAppointments(req.user.id);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  cancelAppointment(@Request() req, @Param('id') id: string) {
    return this.appointmentService.cancelAppointment(req.user.id, id);
  }

  @Patch(':id/reschedule')
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  rescheduleAppointment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentService.rescheduleAppointment(req.user.id, id, dto);
  }
}

@Controller('doctor')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('DOCTOR')
export class DoctorAppointmentController {
  constructor(private appointmentService: AppointmentService) {}

  @Get('appointments')
  getDoctorAppointments(@Request() req) {
    return this.appointmentService.getDoctorAppointments(req.user.id);
  }
}