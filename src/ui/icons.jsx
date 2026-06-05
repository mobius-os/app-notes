export function Icon({ name, size = 17 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }
  if (name === 'pin') {
    return (
      <svg {...common}>
        <path d="M12 17v5" />
        <path d="M9 3h6l1 7 3 3v2H5v-2l3-3 1-7Z" />
      </svg>
    )
  }
  if (name === 'palette') {
    return (
      <svg {...common}>
        <path d="M12 3a9 9 0 0 0 0 18h1.5a1.8 1.8 0 0 0 1.2-3.15 1.6 1.6 0 0 1 1.05-2.85H17a4 4 0 0 0 4-4c0-4.42-4.03-8-9-8Z" />
        <circle cx="7.5" cy="10" r=".6" fill="currentColor" stroke="none" />
        <circle cx="10" cy="7.5" r=".6" fill="currentColor" stroke="none" />
        <circle cx="14" cy="7.5" r=".6" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (name === 'paperclip') {
    return (
      <svg {...common}>
        <path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l8.5-8.5a4 4 0 0 1 5.7 5.7l-8.5 8.5a2 2 0 1 1-2.8-2.8l7.8-7.8" />
      </svg>
    )
  }
  if (name === 'trash') {
    return (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m6 6 1 15h10l1-15" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    )
  }
  if (name === 'back') {
    return (
      <svg {...common}>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    )
  }
  if (name === 'edit') {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    )
  }
  return null
}
