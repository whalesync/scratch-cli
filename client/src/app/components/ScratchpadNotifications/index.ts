import { notifications } from '@mantine/notifications';
import classes from './notifications.module.css';

interface NotificationData {
  title?: string;
  message: string;
};

/* 
 Interface for showing Mantine notifications using standard formats
 */
export const ScratchpadNotifications = {
  info: (data: NotificationData) => {
    return notifications.show({
      title: data.title,
      message: data.message,
      color: 'gray.8',
      variant: 'light',
      position: 'bottom-right',
      classNames: classes,
    });
  },
  success: (data: NotificationData) => {
    return notifications.show({
      title: data.title,
      message: data.message,
      color: 'green.8',
      variant: 'light',
      position: 'bottom-right',
      classNames: classes,
    });
  },
  warning: (data: NotificationData) => {
    return notifications.show({
      title: data.title,
      message: data.message,
      color: 'yellow.8',
      variant: 'light',
      position: 'bottom-right',
      classNames: classes,
    });
  },
  error: (data: NotificationData) => {
    return notifications.show({
      title: data.title,
      message: data.message,
      color: 'red.8',
      variant: 'light',
      position: 'bottom-right',
      classNames: classes,
    });
  },
};
