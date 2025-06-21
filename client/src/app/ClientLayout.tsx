"use client";

import { AppShell, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import { SideMenu } from "./components/SideMenu";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkAuthContextProvider } from "@/contexts/auth";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MantineProvider>
      <Notifications />
      <ClerkProvider>
        <ClerkAuthContextProvider>
          <AppShell navbar={{ width: 200, breakpoint: "sm" }}>
            <AppShell.Navbar p={0}>
              <SideMenu />
            </AppShell.Navbar>

            <AppShell.Main>{children}</AppShell.Main>
          </AppShell>
        </ClerkAuthContextProvider>
      </ClerkProvider>
    </MantineProvider>
  );
}
