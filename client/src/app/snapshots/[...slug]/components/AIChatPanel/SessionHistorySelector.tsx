import { TextRegularXs } from '@/app/components/base/text';
import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { useAIAgentSessionManagerContext } from '@/contexts/ai-agent-session-manager-context';
import { ChatSessionSummary } from '@/types/server-entities/chat-session';
import { timeAgo } from '@/utils/helpers';
import { ActionIcon, Combobox, Group, Text, Tooltip, useCombobox } from '@mantine/core';
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react';
import { useCallback, useMemo } from 'react';

export const SessionHistorySelector = ({ onSelect }: { onSelect: (sessionId: string) => void }) => {
  const combobox = useCombobox();

  const { sessions, activeSessionId } = useAIAgentSessionManagerContext();

  const createSessionOption = useCallback(
    (session: ChatSessionSummary) => {
      return (
        <Combobox.Option value={session.id} key={session.id}>
          <Group gap="2xs" justify="space-between" align="center">
            {activeSessionId === session.id ? (
              <>
                <TextRegularXs>{session.name}</TextRegularXs>
                <Text size="xs" c="dimmed">
                  active
                </Text>
              </>
            ) : (
              <>
                <TextRegularXs>{session.name}</TextRegularXs>
                <Text size="xs" c="dimmed">
                  {timeAgo(session.created_at)}
                </Text>
              </>
            )}
          </Group>
        </Combobox.Option>
      );
    },
    [activeSessionId],
  );

  const comboBoxOptions = useMemo(() => {
    if (sessions.length === 0) {
      return (
        <Combobox.Option value="none" key="none" disabled>
          <TextRegularXs>No sessions found</TextRegularXs>
        </Combobox.Option>
      );
    }

    // Sort sessions by created_at in descending order
    const sortedSessions = sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Split sessions into today and past
    const todaySessions = sortedSessions.filter((session) => new Date(session.created_at) >= today);
    const pastSessions = sortedSessions.filter((session) => new Date(session.created_at) < today);

    const options = [];

    // Add today sessions section
    if (todaySessions.length > 0) {
      todaySessions.forEach((session) => {
        options.push(createSessionOption(session));
      });
    }

    // Add past sessions section
    if (pastSessions.length > 0) {
      options.push(
        <Combobox.Option value="past-header" key="past-header" disabled>
          <Text size="xs" fw={600} c="dimmed">
            Older sessions
          </Text>
        </Combobox.Option>,
      );

      pastSessions.forEach((session) => {
        options.push(createSessionOption(session));
      });
    }

    return options;
  }, [sessions, createSessionOption]);

  return (
    <Combobox
      store={combobox}
      width={350}
      withArrow
      position="bottom-end"
      withinPortal={false}
      onOptionSubmit={(val) => {
        if (val) {
          onSelect(val);
          combobox.closeDropdown();
        }
      }}
    >
      <Combobox.Target>
        <Tooltip label="Chat history">
          <ActionIcon variant="subtle" size="sm" onClick={() => combobox.toggleDropdown()}>
            <StyledIcon Icon={ClockCounterClockwiseIcon} />
          </ActionIcon>
        </Tooltip>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>{comboBoxOptions}</Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
};
