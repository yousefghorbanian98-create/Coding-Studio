import type { SVGProps } from 'react';

export type IconName =
  | 'alert'
  | 'chat'
  | 'sessions'
  | 'files'
  | 'search'
  | 'extensions'
  | 'settings'
  | 'plus'
  | 'send'
  | 'stop'
  | 'sidebar'
  | 'inspector'
  | 'sun'
  | 'moon'
  | 'globe'
  | 'command'
  | 'check'
  | 'chevron'
  | 'copy'
  | 'trash'
  | 'sparkle'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'close'
  | 'branch'
  | 'dot';

const PATHS: Record<IconName, string> = {
  chat: 'M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8Z',
  sessions: 'M4 6h16M4 12h16M4 18h10',
  files: 'M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35',
  extensions:
    'M10 4h4v3a2 2 0 1 0 4 0h2v4h-3a2 2 0 1 0 0 4h3v4h-4v-3a2 2 0 1 0-4 0v3H6v-4H4a2 2 0 1 0 0-4h2V7h4V4Z',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.13-1.4l2.1-1.6-2-3.46-2.5 1a8 8 0 0 0-2.42-1.4L14.7 2h-4l-.35 2.6a8 8 0 0 0-2.42 1.4l-2.5-1-2 3.46 2.1 1.6a8.2 8.2 0 0 0 0 2.8l-2.1 1.6 2 3.46 2.5-1a8 8 0 0 0 2.42 1.4l.35 2.68h4l.35-2.68a8 8 0 0 0 2.42-1.4l2.5 1 2-3.46-2.1-1.6c.09-.46.13-.93.13-1.4Z',
  plus: 'M12 5v14M5 12h14',
  send: 'M4 12 20 4l-8 16-2-6-6-2Z',
  stop: 'M8 8h8v8H8z',
  sidebar: 'M4 5h16v14H4zM10 5v14',
  inspector: 'M4 5h16v14H4zM15 5v14',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M19.1 4.9l-1.5 1.5M6.4 17.6l-1.5 1.5',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.4 3.75-5.4 3.75-9S14.5 5.4 12 3C9.5 5.4 8.25 8.4 8.25 12S9.5 18.6 12 21ZM3.5 9h17m-17 6h17',
  command:
    'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z',
  check: 'm5 13 4 4L19 7',
  chevron: 'm9 6 6 6-6 6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  sparkle:
    'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z',
  minimize: 'M5 12h14',
  maximize: 'M5 5h14v14H5z',
  restore: 'M8 8V5h11v11h-3M5 8h11v11H5z',
  close: 'M6 6l12 12M18 6 6 18',
  branch: 'M6 4v10a4 4 0 0 0 4 4h4M6 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  dot: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  alert: 'M12 9v4m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
