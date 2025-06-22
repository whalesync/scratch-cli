import { Flex, Loader } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { JSX } from "react";

interface FullPageLoaderProps {
  size?: number | "xs" | "sm" | "md" | "lg" | "xl";
  color?: string;
  variant?: "bars" | "oval" | "dots";
}

export const FullPageLoader = (props: FullPageLoaderProps): JSX.Element => {
  const { height, width } = useViewportSize();
  return (
    <Flex justify="center" align="center" h={height} w={width}>
      <Loader {...props} size={props.size ?? "lg"} />
    </Flex>
  );
};
