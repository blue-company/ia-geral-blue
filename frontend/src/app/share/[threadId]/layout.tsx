import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conversa Compartilhada',
  description: 'Visualize uma conversa de IA compartilhada',
  openGraph: {
    title: 'Conversa de IA Compartilhada',
    description: 'Visualize uma conversa de IA compartilhada do Agent0',
    images: ['/kortix-logo.png'],
  },
};

export default function ThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 