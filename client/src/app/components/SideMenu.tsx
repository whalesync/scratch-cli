"use client";

import {
  ActionIcon,
  Center,
  CopyButton,
  Group,
  NavLink,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  TestTubeIcon,
  PlugsIcon,
  SpiralIcon,
  CloudArrowDownIcon,
  CheckIcon,
  CopyIcon,
  ChatCircleIcon,
} from "@phosphor-icons/react";
import { UserButton } from "@clerk/nextjs";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { useScratchPadUser } from "@/hooks/useScratchpadUser";
import { RouteUrls } from "@/utils/route-urls";

const links = [
  {
    href: RouteUrls.chatPageUrl,
    label: "Chat",
    icon: <ChatCircleIcon size={16} />,
  },
  {
    href: RouteUrls.connectionsPageUrl,
    label: "Connections",
    icon: <PlugsIcon size={16} />,
  },
  {
    href: RouteUrls.apiImportDemoPageUrl,
    label: "API Import Demo",
    icon: <CloudArrowDownIcon size={16} />,
  },
  {
    href: RouteUrls.healthPageUrl,
    label: "Health",
    icon: <TestTubeIcon size={16} />,
  },
];

export function SideMenu() {
  const pathname = usePathname();
  const { user } = useScratchPadUser();

  return (
    <Stack gap={0} h="100%">
      <Center p="xs">
        <SpiralIcon size={100} color="#00A2E9" />
      </Center>

      {links.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          component={Link}
          active={pathname === link.href}
          leftSection={link.icon}
        />
      ))}
      <Stack justify="center" mt="auto" p="xs">
        <SignedOut>
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          {user && (
            <Stack gap="xs" pl="xs">
              <Group wrap="nowrap" gap="xs">
                <Text c="dimmed" size="xs">
                  User ID
                </Text>
                <CopyButton value={user.id} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip
                      label={copied ? "Copied" : `${user.id}`}
                      withArrow
                      position="right"
                    >
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                      >
                        {copied ? (
                          <CheckIcon size={16} />
                        ) : (
                          <CopyIcon size={16} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              {user.apiToken && (
                <>
                  <Group wrap="nowrap" gap="xs">
                    <Text c="dimmed" size="xs">
                      API Token
                    </Text>
                    <CopyButton value={user.apiToken} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip
                          label={copied ? "Copied" : `${user.apiToken}`}
                          withArrow
                          position="right"
                        >
                          <ActionIcon
                            color={copied ? "teal" : "gray"}
                            variant="subtle"
                            onClick={copy}
                          >
                            {copied ? (
                              <CheckIcon size={16} />
                            ) : (
                              <CopyIcon size={16} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </>
              )}
            </Stack>
          )}
          <UserButton showName />
        </SignedIn>
      </Stack>
    </Stack>
  );
}
