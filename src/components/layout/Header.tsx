export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
      <span className="text-lg font-semibold tracking-tight md:hidden">MiniATS</span>
      {/* TODO(#14): admin "Acting as organization" selector */}
      {/* TODO(#7): current user + logout */}
      <div className="ml-auto" />
    </header>
  );
}
