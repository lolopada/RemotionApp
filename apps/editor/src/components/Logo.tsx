export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-md bg-accent" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" style={{ width: size * 0.58, height: size * 0.58 }} aria-hidden="true">
        <path d="M11 8v16l13-8z" fill="#fff" />
      </svg>
    </div>
  );
}
