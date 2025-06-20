"use client";

import { Center, NavLink, Stack } from "@mantine/core";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  TestTubeIcon,
  PlugsIcon,
  RocketLaunchIcon,
  SpiralIcon,
} from "@phosphor-icons/react";
import { UserButton } from "@clerk/nextjs";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";

const links = [
  {
    href: "/mcp-demo",
    label: "MCP Demo",
    icon: <RocketLaunchIcon size={16} />,
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
        </SignedIn>
      </Stack>
    </Stack>
  );
}
