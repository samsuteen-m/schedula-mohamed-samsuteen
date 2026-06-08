import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PatientService } from './patient.service';
import { PatientProfileDto } from './patient.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('patient')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('PATIENT')
export class PatientController {
  constructor(private patientService: PatientService) {}

  @Post('profile')
  createProfile(@Request() req, @Body() dto: PatientProfileDto) {
    return this.patientService.createProfile(req.user.id, dto);
  }

  @Get('profile')
  getProfile(@Request() req) {
    return this.patientService.getProfile(req.user.id);
  }

  @Patch('profile')
  updateProfile(@Request() req, @Body() dto: PatientProfileDto) {
    return this.patientService.updateProfile(req.user.id, dto);
  }
}