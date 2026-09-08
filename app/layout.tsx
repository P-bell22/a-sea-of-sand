import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'A Sea of Sand — Dune Observatory',
  description: 'Watch dune crests travel across a desert in an interactive aerial time-lapse. Explore wind, time, scale, and the journey of a sand grain.',
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" className="dark"><body>{children}</body></html>;
}
