import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from './notification.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('PATIENT')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  getNotifications(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationService.getNotifications(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      type,
    );
  }

  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Patch('read-all')
  markAllAsRead(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  markAsRead(@Request() req, @Param('id') id: string) {
    return this.notificationService.markAsRead(req.user.id, id);
  }

  @Delete('clear/read')
  deleteAllRead(@Request() req) {
    return this.notificationService.deleteAllRead(req.user.id);
  }

  @Delete(':id')
  deleteNotification(@Request() req, @Param('id') id: string) {
    return this.notificationService.deleteNotification(req.user.id, id);
  }
}