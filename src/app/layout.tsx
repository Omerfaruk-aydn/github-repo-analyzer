import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepoMind — AI-Powered GitHub Repository Analyzer",
  description: "Analyze codebases, generate interactive architecture graphs, spot bugs, scan security flaws, and chat with your repository directly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#030305] text-gray-100 flex flex-col relative overflow-x-hidden">
        {/* Animated Glow Backdrops */}
        <div className="glow-orb glow-orb-primary" />
        <div className="glow-orb glow-orb-secondary" />
        <div className="glow-orb glow-orb-tertiary" />

        <div className="relative z-10 flex flex-col flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
