'use client';

import { ThemeProvider } from 'next-themes';

export function ThemeProviderClientComponent({ children, ...props }) {
  return <ThemeProvider {...props}>{children}</ThemeProvider>;
} 