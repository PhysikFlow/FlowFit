const iconPaths = {
  "arrow-right": [
    '<path d="M5 12h14" />',
    '<path d="m13 6 6 6-6 6" />'
  ],
  bell: [
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />',
    '<path d="M10 21h4" />'
  ],
  calendar: [
    '<path d="M8 3v4" />',
    '<path d="M16 3v4" />',
    '<path d="M4 9h16" />',
    '<path d="M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />'
  ],
  check: [
    '<path d="m5 12 4 4L19 6" />'
  ],
  chart: [
    '<path d="M4 19V5" />',
    '<path d="M4 19h16" />',
    '<path d="M8 16v-5" />',
    '<path d="M12 16V8" />',
    '<path d="M16 16v-7" />'
  ],
  "chevron-right": [
    '<path d="m9 18 6-6-6-6" />'
  ],
  "chevron-down": [
    '<path d="m6 9 6 6 6-6" />'
  ],
  clock: [
    '<circle cx="12" cy="12" r="8" />',
    '<path d="M12 8v5l3 2" />'
  ],
  database: [
    '<ellipse cx="12" cy="5" rx="7" ry="3" />',
    '<path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />',
    '<path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />'
  ],
  dumbbell: [
    '<path d="M6 7v10" />',
    '<path d="M18 7v10" />',
    '<path d="M3 9v6" />',
    '<path d="M21 9v6" />',
    '<path d="M6 12h12" />'
  ],
  home: [
    '<path d="M4 11 12 4l8 7" />',
    '<path d="M6 10v10h12V10" />',
    '<path d="M10 20v-6h4v6" />'
  ],
  list: [
    '<path d="M8 6h12" />',
    '<path d="M8 12h12" />',
    '<path d="M8 18h12" />',
    '<path d="M4 6h.01" />',
    '<path d="M4 12h.01" />',
    '<path d="M4 18h.01" />'
  ],
  menu: [
    '<path d="M4 7h16" />',
    '<path d="M4 12h16" />',
    '<path d="M4 17h16" />'
  ],
  message: [
    '<path d="M5 5h14v10H8l-3 4V5Z" />'
  ],
  notification: [
    '<path d="M12 5v14" />',
    '<path d="M5 12h14" />',
    '<path d="m7 7 10 10" />',
    '<path d="m17 7-10 10" />'
  ],
  plus: [
    '<path d="M12 5v14" />',
    '<path d="M5 12h14" />'
  ],
  dots: [
    '<circle cx="12" cy="6" r="1.5" />',
    '<circle cx="12" cy="12" r="1.5" />',
    '<circle cx="12" cy="18" r="1.5" />'
  ],
  palette: [
    '<circle cx="12" cy="12" r="8" />',
    '<circle cx="9" cy="10" r=".8" />',
    '<circle cx="12" cy="8" r=".8" />',
    '<circle cx="15" cy="10" r=".8" />',
    '<path d="M13 16h1a2 2 0 0 0 0-4h-2a3 3 0 0 0 0 6" />'
  ],
  play: [
    '<path d="M8 5v14l11-7Z" />'
  ],
  profile: [
    '<circle cx="12" cy="8" r="4" />',
    '<path d="M4 21a8 8 0 0 1 16 0" />'
  ],
  refresh: [
    '<path d="M20 11a8 8 0 0 0-14-5l-2 2" />',
    '<path d="M4 4v4h4" />',
    '<path d="M4 13a8 8 0 0 0 14 5l2-2" />',
    '<path d="M20 20v-4h-4" />'
  ],
  ruler: [
    '<path d="M4 17 17 4l3 3L7 20l-3-3Z" />',
    '<path d="m8 13 2 2" />',
    '<path d="m11 10 2 2" />',
    '<path d="m14 7 2 2" />'
  ],
  scale: [
    '<path d="M6 4h12a2 2 0 0 1 2 2v12H4V6a2 2 0 0 1 2-2Z" />',
    '<path d="M9 9a3 3 0 0 1 6 0" />',
    '<path d="M12 9l2-2" />'
  ],
  target: [
    '<circle cx="12" cy="12" r="8" />',
    '<circle cx="12" cy="12" r="4" />',
    '<path d="M12 12h8" />'
  ],
  trophy: [
    '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />',
    '<path d="M8 6H4a4 4 0 0 0 4 4" />',
    '<path d="M16 6h4a4 4 0 0 1-4 4" />',
    '<path d="M12 13v4" />',
    '<path d="M9 20h6" />'
  ],
  user: [
    '<circle cx="12" cy="8" r="4" />',
    '<path d="M5 20a7 7 0 0 1 14 0" />'
  ],
  users: [
    '<circle cx="9" cy="8" r="3" />',
    '<path d="M3 20a6 6 0 0 1 12 0" />',
    '<path d="M16 11a3 3 0 0 0 0-6" />',
    '<path d="M18 20a5 5 0 0 0-4-5" />'
  ],
  wallet: [
    '<path d="M4 7h15a1 1 0 0 1 1 1v10H4V7Z" />',
    '<path d="M4 7V5h13" />',
    '<path d="M16 13h4" />',
    '<path d="M17 13h.01" />'
  ],
  weight: [
    '<path d="M8 8a4 4 0 0 1 8 0" />',
    '<path d="M6 8h12l2 12H4L6 8Z" />'
  ]
};

export const svgIcon = (name, className = "icon") => {
  const paths = iconPaths[name] || iconPaths.target;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths.join("")}</svg>`;
};
