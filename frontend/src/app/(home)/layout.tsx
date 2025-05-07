import { Navbar } from "@/components/home/sections/navbar";

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full relative bg-black">
      <Navbar />
      {children}
    </div>
  );
}
