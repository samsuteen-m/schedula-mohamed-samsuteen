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

  // Internal method — called from appointment service
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

  async getNotifications(patientId: string) {
    const notifications = await this.notificationRepo.find({
      where: { patient: { id: patientId } },
      order: { createdAt: 'DESC' },
    });

    if (notifications.length === 0) {
      return {
        message: 'No notifications found',
        total: 0,
        unreadCount: 0,
        data: [],
      };
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return {
      total: notifications.length,
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

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.patient.id !== patientId) {
      throw new ForbiddenException(
        'You can only access your own notifications',
      );
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
      return {
        message: 'No unread notifications found',
        updatedCount: 0,
      };
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
      message: unreadCount === 0
        ? 'No unread notifications'
        : `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`,
    };
  }
}