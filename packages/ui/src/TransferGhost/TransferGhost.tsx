'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { deltaTransform, type Rect } from '../utils/flip';
import styles from './TransferGhost.module.css';

export interface TransferGhostProps {
  /** Where the moved content visually starts. */
  from: Rect;
  /** Where the moved content ends up — matches its real destination DOM
   * position, so this ghost hands off invisibly to the real render. */
  to: Rect;
  durationMs?: number;
  onDone: () => void;
  children: ReactNode;
}

/** Portal-rendered ghost element that plays a single FLIP transition from
 * `from` to `to`, then calls `onDone` — used for both money and animal card
 * transfers (spec §2: "one utility, reused by both"), never mutates any
 * game state itself. */
export function TransferGhost({ from, to, durationMs = 500, onDone, children }: TransferGhostProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimateIn(true));
    const timer = setTimeout(() => onDoneRef.current(), durationMs);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [durationMs]);

  const style = {
    position: 'fixed' as const,
    top: to.top,
    left: to.left,
    width: to.width,
    height: to.height,
    transform: animateIn ? 'none' : deltaTransform(from, to),
    transition: animateIn ? `transform ${durationMs}ms ease` : 'none',
  };

  return createPortal(
    <div style={style} className={styles.ghost}>
      {children}
    </div>,
    document.body,
  );
}
