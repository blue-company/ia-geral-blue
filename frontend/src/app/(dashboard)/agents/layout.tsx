import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversa com Agente | Subzero",
  description: "Conversa interativa com agente desenvolvida pela Subzero",
  openGraph: {
    title: "Conversa com Agente | Subzero",
    description: "Conversa interativa com agente desenvolvida pela Subzero",
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