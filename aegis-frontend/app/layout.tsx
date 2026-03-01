import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aegis Protocol V5 — AI Security Firewall',
  description: 'ERC-7579 Executor Module with Chainlink CRE Oracle. Zero-custody AI trading security.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
