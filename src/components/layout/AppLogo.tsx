export function AppLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="orange-grad-main" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--gold-hi)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
        <linearGradient id="orange-grad-light" x1="0" y1="40" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--gold)" />
          <stop offset="1" stopColor="#FDBA74" />
        </linearGradient>
        <linearGradient id="orange-grad-dark" x1="20" y1="20" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--gold)" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>
      
      {/* Top Facet */}
      <path d="M20 4L34 11L20 18L6 11L20 4Z" fill="url(#orange-grad-light)" />
      
      {/* Left Facet */}
      <path d="M6 13L20 20V36L6 29V13Z" fill="url(#orange-grad-main)" />
      
      {/* Right Facet */}
      <path d="M34 13L20 20V36L34 29V13Z" fill="url(#orange-grad-dark)" />
      
      {/* Internal floating core */}
      <path d="M20 16L24 18V22L20 24L16 22V18L20 16Z" fill="#FFFFFF" fillOpacity="0.9" />
      <path d="M20 12L21 15L24 16L21 17L20 20L19 17L16 16L19 15L20 12Z" fill="#FFFFFF" fillOpacity="0.5" />
    </svg>
  );
}
