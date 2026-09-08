export default function RootPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-100 p-6">
      <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-bg-90 px-6 py-5">
        <p className="text-2xs font-medium tracking-wide text-text-400 uppercase">
          Phase 1
        </p>
        <h1 className="mt-1 text-lg font-medium text-text-100">
          CyberSec Atria IT
        </h1>
        <p className="mt-2 text-sm text-text-300">
          Scaffold and design tokens are in place. The application shell arrives
          in phase 6.
        </p>
        <div className="mt-4 flex gap-1.5">
          {["bg-bg-100", "bg-bg-90", "bg-bg-80", "bg-bg-70", "bg-bg-60"].map(
            (token) => (
              <div
                key={token}
                className={`h-6 w-6 rounded-sm border border-border-subtle ${token}`}
              />
            ),
          )}
        </div>
      </div>
    </main>
  );
}
