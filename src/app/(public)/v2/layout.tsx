import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { V2Chrome } from '@/components/ttc/v2/V2Chrome';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--v2-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--v2-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`v2 ${display.variable} ${mono.variable}`}>
      <V2Chrome>{children}</V2Chrome>
    </div>
  );
}
