import { ArrowsClockwiseIcon, IconProps } from "@phosphor-icons/react";
import styles from "./AnimatedArrowsClockwise.module.css";
import { JSX } from "react";

export const AnimatedArrowsClockwise = (props: IconProps): JSX.Element => {
  return <ArrowsClockwiseIcon {...props} className={styles.spinAnimation} />;
};
