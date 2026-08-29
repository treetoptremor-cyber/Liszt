export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      Liszt<span className="wordmark-dot">.</span>
    </span>
  );
}
