import type {Metadata} from 'next';
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css'; // Global styles

// Fraunces: serif editorial de peso denso — usada com moderação para os
// títulos da landing page e do modal de autenticação, evocando o
// registro de um relatório clínico impresso em vez do sans-serif
// genérico de SaaS. IBM Plex Sans/Mono: par técnico e neutro para corpo
// de texto e dados/rótulos, coerente com o vocabulário de triagem
// clínica (Manchester) que o produto usa.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MediFlux CRM Health | Sistema Integrado de Atendimento Clínico & Triagem Inteligente',
  description: 'Plataforma completa de gestão de atendimentos para clínicas médicas com triagem Manchester dual AI, isolamento multi-tenant e conformidade LGPD.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
