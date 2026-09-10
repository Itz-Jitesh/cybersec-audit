export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-100 px-6 py-12">
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
