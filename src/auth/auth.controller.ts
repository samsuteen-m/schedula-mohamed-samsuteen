<<<<<<< HEAD
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
=======
import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
>>>>>>> main

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
<<<<<<< HEAD
=======

  @Get('doctor/profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DOCTOR')
  doctorProfile(@Request() req) {
    return { message: 'Welcome Doctor!', user: req.user };
  }

  @Get('patient/profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('PATIENT')
  patientProfile(@Request() req) {
    return { message: 'Welcome Patient!', user: req.user };
  }
>>>>>>> main
}