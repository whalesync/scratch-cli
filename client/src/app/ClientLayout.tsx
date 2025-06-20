"use client";

import { AppShell, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import { SideMenu } from "./components/SideMenu";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MantineProvider>
      <Notifications />
      <AppShell navbar={{ width: 200, breakpoint: "sm" }}>
        <AppShell.Navbar p={0}>
          <SideMenu />
        </AppShell.Navbar>

        <AppShell.Main>{children}</AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
