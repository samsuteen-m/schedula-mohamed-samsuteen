import { Controller, Post, Get, Patch, Body, UseGuards, Request, Query, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DoctorService } from './doctor.service';
import { DoctorProfileDto } from './doctor.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('doctor')
export class DoctorController {
  constructor(private doctorService: DoctorService) {}

  @Get()
  getAllDoctors(@Query() query: any) {
    return this.doctorService.getAllDoctors(query);
  }

  @Get(':id')
  getDoctorById(@Param('id') id: string) {
    return this.doctorService.getDoctorById(id);
  }

  @Post('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  createProfile(@Request() req, @Body() dto: DoctorProfileDto) {
    return this.doctorService.createProfile(req.user.id, dto);
  }

  @Get('my/profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  getProfile(@Request() req) {
    return this.doctorService.getProfile(req.user.id);
  }

  @Patch('my/profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  updateProfile(@Request() req, @Body() dto: DoctorProfileDto) {
    return this.doctorService.updateProfile(req.user.id, dto);
  }
}