'use client';

export function ChatHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <svg
            className="h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">
            智能客服助手
          </h1>
          <p className="text-[11px] text-muted-foreground">
            订单查询 · 物流跟踪 · 售后处理
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            在线
          </span>
        </div>
      </div>
    </header>
  );
}
