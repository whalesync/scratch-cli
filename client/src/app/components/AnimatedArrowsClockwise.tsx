import { RotateCwIcon } from 'lucide-react';
import { JSX } from 'react';
import styles from './AnimatedArrowsClockwise.module.css';

export const AnimatedArrowsClockwise = ({ size }: { size: number }): JSX.Element => {
  return <RotateCwIcon size={size} className={styles.spinAnimation} />;
};
