import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DesignFeed — 优秀网站与设计规范社区",
    template: "%s · DesignFeed",
  },
  description: "发现优秀网站，查看可复用的字体、色彩、布局与组件设计规范。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
