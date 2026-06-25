import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async createNotification(
    patientId: string,
    title: string,
    message: string,
    type: NotificationType,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      patient: { id: patientId },
      title,
      message,
      type,
      isRead: false,
    });
    return await this.notificationRepo.save(notification);
  }

  async getNotifications(
    patientId: string,
    page: number = 1,
    limit: number = 10,
    type?: string,
  ) {
    const skip = (page - 1) * limit;
    const whereCondition: any = { patient: { id: patientId } };
    if (type) whereCondition.type = type;

    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { patient: { id: patientId }, isRead: false },
    });

    if (notifications.length === 0) {
      return {
        message: 'No notifications found',
        total: 0,
        page,
        limit,
        totalPages: 0,
        unreadCount: 0,
        data: [],
      };
    }

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
      data: notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    };
  }

  async markAsRead(patientId: string, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
      relations: ['patient'],
    });

    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.patient.id !== patientId) {
      throw new ForbiddenException('You can only access your own notifications');
    }

    if (notification.isRead) {
      return {
        message: 'Notification is already marked as read',
        notification: {
          id: notification.id,
          title: notification.title,
          isRead: notification.isRead,
        },
      };
    }

    notification.isRead = true;
    await this.notificationRepo.save(notification);

    return {
      message: 'Notification marked as read successfully',
      notification: {
        id: notification.id,
        title: notification.title,
        isRead: notification.isRead,
      },
    };
  }

  async markAllAsRead(patientId: string) {
    const unreadNotifications = await this.notificationRepo.find({
      where: { patient: { id: patientId }, isRead: false },
    });

    if (unreadNotifications.length === 0) {
      return { message: 'No unread notifications found', updatedCount: 0 };
    }

    for (const notification of unreadNotifications) {
      notification.isRead = true;
    }
    await this.notificationRepo.save(unreadNotifications);

    return {
      message: `${unreadNotifications.length} notifications marked as read`,
      updatedCount: unreadNotifications.length,
    };
  }

  async getUnreadCount(patientId: string) {
    const unreadCount = await this.notificationRepo.count({
      where: { patient: { id: patientId }, isRead: false },
    });

    return {
      unreadCount,
      message:
        unreadCount === 0
          ? 'No unread notifications'
          : `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`,
    };
  }

  async deleteNotification(patientId: string, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
      relations: ['patient'],
    });

    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.patient.id !== patientId) {
      throw new ForbiddenException('You can only delete your own notifications');
    }

    await this.notificationRepo.remove(notification);
    return { message: 'Notification deleted successfully' };
  }

  async deleteAllRead(patientId: string) {
    const readNotifications = await this.notificationRepo.find({
      where: { patient: { id: patientId }, isRead: true },
    });

    if (readNotifications.length === 0) {
      return { message: 'No read notifications to delete', deletedCount: 0 };
    }

    await this.notificationRepo.remove(readNotifications);
    return {
      message: `${readNotifications.length} read notifications deleted successfully`,
      deletedCount: readNotifications.length,
    };
  }
}