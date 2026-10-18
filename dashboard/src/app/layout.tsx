import type { Metadata } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap',
});

const notoSansArabic = Noto_Sans_Arabic({ 
  subsets: ['arabic'], 
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Liberty City Bot - Dashboard',
  description: 'لوحة تحكم بوت Liberty City - إدارة السيرفر والحماية والذكاء الاصطناعي',
  keywords: ['Discord Bot', 'Liberty City', 'Server Management', 'Dashboard'],
  authors: [{ name: 'Liberty City Team' }],
  openGraph: {
    title: 'Liberty City Bot - Dashboard',
    description: 'لوحة تحكم متقدمة لإدارة سيرفرات Discord',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${notoSansArabic.variable} font-sans`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} ${notoSansArabic.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}