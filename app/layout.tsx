import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUMI · 儿童英语智能学习平台",
  description: "面向幼儿园和小学生的英语智能助教、作业批改与个性化学习平台。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
