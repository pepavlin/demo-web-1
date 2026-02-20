# Demo Web

## Liquid Glass Clock

A modern, animated real-time clock built with Next.js featuring a liquid glass (glassmorphism) aesthetic.

### Features

- **Real-time clock** — displays hours, minutes, and seconds updated every second
- **Liquid glass UI** — deep backdrop blur, translucent layers, inset highlights and shadows
- **Animated background** — four animated gradient blobs creating a living, breathing background
- **Digit animations** — each digit transitions smoothly with a blur-fade effect via Framer Motion
- **Progress bars** — visual progress indicators for hours, minutes, and seconds
- **Floating particles** — 25 rising particles with random colors and drift
- **Shimmer text** — animated gradient shimmer on the day-of-week label
- **Czech locale** — date and day names displayed in Czech

### Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)

### Getting Started

```bash
cd liquid-glass-clock
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

```bash
npm test
```

8 tests covering the `Clock` and `LiquidBackground` components.
