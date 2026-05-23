import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Citadels',
  description: 'The classic city-building card game, digitized.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-white antialiased">{children}</body>
    </html>
  );
}
