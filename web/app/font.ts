import localFont from 'next/font/local';

export const Excon = localFont({
  src: '../public/fonts/Excon-Variable.woff2',
  variable: '--font-jetbrains',
});

export const Disket = localFont({
  src: [
    { path: '../public/fonts/JetBrainsMono-Variable.woff2', weight: '400', style: 'normal' },
    // { path: '../public/fonts/Disket-Mono-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-disket',
});
