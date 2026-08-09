import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '智能客服助手 | 订单查询 · 物流跟踪 · 售后处理',
  description: '基于 AI 工作流的智能客服对话系统，支持订单查询、物流跟踪、售后处理等场景。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
