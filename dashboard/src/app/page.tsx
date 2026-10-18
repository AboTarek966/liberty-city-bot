import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Liberty City Bot - Dashboard',
  description: 'لوحة تحكم بوت Liberty City - إدارة السيرفر والحماية والذكاء الاصطناعي',
};

export default function Home() {
  redirect('/dashboard');
}