import { notifications } from '@mantine/notifications';
import classes from './notifications.module.css';

interface NotificationData {
  title?: string;
  message: React.ReactNode;
  autoClose?: boolean | number;
}

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
      autoClose: data.autoClose,
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
      autoClose: data.autoClose,
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
      autoClose: data.autoClose,
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
      autoClose: data.autoClose,
    });
  },
};
