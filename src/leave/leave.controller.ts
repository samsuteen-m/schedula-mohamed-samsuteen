import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, UpdateLeaveDto } from './leave.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('doctor/leave')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('DOCTOR')
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @Post()
  createLeave(@Request() req, @Body() dto: CreateLeaveDto) {
    return this.leaveService.createLeave(req.user.id, dto);
  }

  @Get()
  getMyLeaves(@Request() req) {
    return this.leaveService.getMyLeaves(req.user.id);
  }

  @Patch(':id')
  updateLeave(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveDto,
  ) {
    return this.leaveService.updateLeave(req.user.id, id, dto);
  }

  @Delete(':id')
  deleteLeave(@Request() req, @Param('id') id: string) {
    return this.leaveService.deleteLeave(req.user.id, id);
  }
}