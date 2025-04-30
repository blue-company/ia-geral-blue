import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversa com Agente | Agent0",
  description: "Conversa interativa com agente desenvolvida pela Agent0",
  openGraph: {
    title: "Conversa com Agente | Agent0",
    description: "Conversa interativa com agente desenvolvida pela Agent0",
    type: "website",
  },
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 