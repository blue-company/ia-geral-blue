import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversa com Agente | AgentZERO",
  description: "Conversa interativa com agente desenvolvida pela AgentZERO",
  openGraph: {
    title: "Conversa com Agente | AgentZERO",
    description: "Conversa interativa com agente desenvolvida pela AgentZERO",
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
