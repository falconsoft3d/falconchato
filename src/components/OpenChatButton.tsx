"use client";

// Abre el widget de falconchato de la página (window.FalconChato lo define /widget.js).
export function OpenChatButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button
      className={className}
      onClick={() => (window as unknown as { FalconChato?: { open: () => void } }).FalconChato?.open()}
    >
      {children}
    </button>
  );
}
