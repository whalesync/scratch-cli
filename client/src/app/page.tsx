"use client";

import { Center, Loader } from "@mantine/core";
import { HouseIcon } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import { RouteUrls } from "@/utils/route-urls";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push(RouteUrls.snapshotsPageUrl);
  }, [router]);

  return (
    <Center h="100vh">
      <HouseIcon size={500} weight="thin" color="#00A2E9" />
      <Loader />
    </Center>
  );
}
