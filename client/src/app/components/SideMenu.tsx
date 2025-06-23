"use client";

import { Center, NavLink, Stack, Text } from "@mantine/core";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  TestTubeIcon,
  PlugsIcon,
  RocketLaunchIcon,
  SpiralIcon,
  CloudArrowDownIcon,
} from "@phosphor-icons/react";
import { UserButton } from "@clerk/nextjs";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { useScratchPadUser } from "@/hooks/useScratchpadUser";

const links = [
  {
    href: "/mcp-demo",
    label: "MCP Demo",
    icon: <RocketLaunchIcon size={16} />,
  },
  {
    href: "/api-import-demo",
    label: "API Import Demo",
    icon: <CloudArrowDownIcon size={16} />,
  },
  {
    href: "/connector-accounts",
    label: "Connections",
    icon: <PlugsIcon size={16} />,
  },
  { href: "/health", label: "Health", icon: <TestTubeIcon size={16} /> },
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
          <UserButton showName />
          <Text c="dimmed" size="xs">
            {user?.id}
          </Text>
        </SignedIn>
      </Stack>
    </Stack>
  );
}
