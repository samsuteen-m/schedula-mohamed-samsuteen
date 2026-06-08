import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DoctorService } from './doctor.service';
import { DoctorProfileDto } from './doctor.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('doctor')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('DOCTOR')
export class DoctorController {
  constructor(private doctorService: DoctorService) {}

  @Post('profile')
  createProfile(@Request() req, @Body() dto: DoctorProfileDto) {
    return this.doctorService.createProfile(req.user.id, dto);
  }

  @Get('profile')
  getProfile(@Request() req) {
    return this.doctorService.getProfile(req.user.id);
  }

  @Patch('profile')
  updateProfile(@Request() req, @Body() dto: DoctorProfileDto) {
    return this.doctorService.updateProfile(req.user.id, dto);
  }
}