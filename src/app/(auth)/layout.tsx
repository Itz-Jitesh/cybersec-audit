export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="auth-grid relative flex min-h-dvh items-center justify-center px-6 py-12">
      {/* Teal radial glow — the single atmospheric moment. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 600px 400px at 50% 40%, rgba(45, 212, 168, 0.06), transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-[400px]">{children}</div>
    </div>
  );
}
