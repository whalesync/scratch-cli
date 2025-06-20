"use client";

import { Center, NavLink, Stack } from "@mantine/core";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  TestTube,
  Plugs,
  RocketLaunch,
  SpiralIcon,
} from "@phosphor-icons/react";

const links = [
  { href: "/mcp-demo", label: "MCP Demo", icon: <RocketLaunch size={16} /> },
  { href: "/connections", label: "Connections", icon: <Plugs size={16} /> },
  { href: "/health", label: "Health", icon: <TestTube size={16} /> },
];

export function SideMenu() {
  const pathname = usePathname();

  return (
    <Stack gap={0}>
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
    </Stack>
  );
}
