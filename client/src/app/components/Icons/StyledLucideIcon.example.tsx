import { Stack, Text } from '@mantine/core';
import { Heart, Settings, User } from 'lucide-react';
import { StyledLucideIcon } from './StyledLucideIcon';

/**
 * Example usage of StyledLucideIcon component
 * This demonstrates how to use Lucide icons with Mantine styling props
 */
export const StyledLucideIconExample = () => {
  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        StyledLucideIcon Examples
      </Text>

      {/* Basic usage */}
      <div>
        <Text size="sm" c="dimmed">
          Basic usage:
        </Text>
        <StyledLucideIcon Icon={Heart} size="md" c="red.5" />
      </div>

      {/* Different sizes */}
      <div>
        <Text size="sm" c="dimmed">
          Different sizes:
        </Text>
        <StyledLucideIcon Icon={Settings} size="xs" c="blue.5" mr="sm" />
        <StyledLucideIcon Icon={Settings} size="sm" c="blue.5" mr="sm" />
        <StyledLucideIcon Icon={Settings} size="md" c="blue.5" mr="sm" />
        <StyledLucideIcon Icon={Settings} size="lg" c="blue.5" mr="sm" />
        <StyledLucideIcon Icon={Settings} size="xl" c="blue.5" />
      </div>

      {/* In text usage */}
      <div>
        <Text size="sm" c="dimmed">
          Inline with text:
        </Text>
        <Text>
          Welcome <StyledLucideIcon Icon={User} size="sm" c="green.6" centerInText /> user!
        </Text>
      </div>

      {/* Custom stroke width */}
      <div>
        <Text size="sm" c="dimmed">
          Custom stroke width:
        </Text>
        <StyledLucideIcon Icon={Heart} size="lg" c="pink.5" strokeWidth={1} mr="sm" />
        <StyledLucideIcon Icon={Heart} size="lg" c="pink.5" strokeWidth={2} mr="sm" />
        <StyledLucideIcon Icon={Heart} size="lg" c="pink.5" strokeWidth={3} />
      </div>
    </Stack>
  );
};
