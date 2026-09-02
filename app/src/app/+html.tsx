import type { ReactNode } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

/**
 * Web 文档壳：确保 Expo 根节点铺满视口，DOM 视觉稿才能按 100vh 精确布局。
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { width: 100%; height: 100%; }
              body { margin: 0; background: #eef1f8; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
