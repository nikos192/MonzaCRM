export function MonzaLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`monza-logo ${className}`}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Monza Forged Wheels"
    >
      <path
        fill="currentColor"
        d="M127 40h62v20h-16v140l65-103h24l65 103V60h-17V40h62v20h-16v187h-34l-72-115-72 115h-34V60h-17V40Zm17 214h34l72 115 72-115h34v186h16v21h-62v-21h17V301l-65 102h-24l-65-102v139h16v21h-62v-21h17V254Z"
      />
    </svg>
  );
}
