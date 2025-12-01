import { Text13Book, Text13Medium } from '@/app/components/base/text';
import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { Box, Stack } from '@mantine/core';

export const BillingSection = ({
  title,
  subtitle,
  children,
  p = 'md',
  hasBorder = true,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  p?: string;
  hasBorder?: boolean;
}) => {
  return (
    <Stack gap="16px">
      <Stack gap="4px">
        <Text13Medium>{title}</Text13Medium>
        <Text13Book c="dimmed">{subtitle}</Text13Book>
      </Stack>
      <Box w="100%" p={p} className={`${hasBorder ? customBordersClasses.cornerBorders : ''}`}>
        {children}
      </Box>
    </Stack>
  );
};
