import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
<<<<<<< HEAD
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { User } from './user/user.entity';
import { Doctor } from './doctor/doctor.entity';
import { Patient } from './patient/patient.entity';
=======
import { User } from './user/user.entity';
>>>>>>> main

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'schedula',
<<<<<<< HEAD
      entities: [User, Doctor, Patient],
      synchronize: true,
    }),
    AuthModule,
    DoctorModule,
    PatientModule,
=======
      entities: [User],
      synchronize: true,
    }),
    AuthModule,
>>>>>>> main
  ],
})
export class AppModule {}