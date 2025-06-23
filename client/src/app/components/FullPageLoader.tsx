import { Flex, Group, Loader, Text } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { JSX } from "react";

interface FullPageLoaderProps {
  size?: number | "xs" | "sm" | "md" | "lg" | "xl";
  color?: string;
  variant?: "bars" | "oval" | "dots";
  message?: string;
}

export const FullPageLoader = (props: FullPageLoaderProps): JSX.Element => {
  const { height, width } = useViewportSize();
  return (
    <Flex justify="center" align="center" h={height} w={width}>
      <Group gap="xs">
        <Loader {...props} size={props.size ?? "lg"} />
        {props.message && <Text>{props.message}</Text>}
      </Group>
    </Flex>
  );
};
