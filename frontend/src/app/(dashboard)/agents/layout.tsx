import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversa com Agente | Thanus",
  description: "Conversa interativa com agente desenvolvida pela Thanus",
  openGraph: {
    title: "Conversa com Agente | Thanus",
    description: "Conversa interativa com agente desenvolvida pela Thanus",
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
