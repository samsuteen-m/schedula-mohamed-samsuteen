import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'Welcome to Schedula API! 🏥',
      status: 'running',
      version: '1.0.0',
      endpoints: {
        auth: '/signup, /login',
        doctor: '/doctor, /doctor/:id, /doctor/profile',
        patient: '/patient/profile',
      },
    };
  }
}