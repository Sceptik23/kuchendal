import type { InputHTMLAttributes } from 'react';
import styles from './FormField.module.css';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[styles.field, className].filter(Boolean).join(' ')} {...rest} />;
}
