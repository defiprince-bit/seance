/** PlanchetteMark: the Séance logo mark (design/logo-mark.svg), decorative. */
export function PlanchetteMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" width={size} height={size}>
      <path d="M16 2.8c3.4 0 12.6 14.6 12.6 20.6 0 4.3-5.4 5.8-12.6 5.8S3.4 27.7 3.4 23.4C3.4 17.4 12.6 2.8 16 2.8Z" stroke="#E9A957" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="16" cy="18" r="5.4" stroke="#E9A957" strokeWidth="1.6"/>
      <rect x="14.6" y="15.6" width="2.8" height="4.8" rx=".4" fill="#9FDDB0"/>
      <circle cx="9" cy="25.4" r=".9" fill="#E9A957"/>
      <circle cx="23" cy="25.4" r=".9" fill="#E9A957"/>
    </svg>
  )
}
