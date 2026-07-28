import type { SelectHTMLAttributes } from 'react';
import styles from './FormField.module.css';

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={[styles.field, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
}
