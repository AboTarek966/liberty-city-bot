import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 7) return `منذ ${days} يوم`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسبوع`;
  if (days < 365) return `منذ ${Math.floor(days / 30)} شهر`;
  return `منذ ${Math.floor(days / 365)} سنة`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getColorForRole(position: number): string {
  if (position === 0) return 'text-yellow-400';
  if (position < 5) return 'text-red-400';
  if (position < 10) return 'text-orange-400';
  if (position < 20) return 'text-yellow-400';
  if (position < 50) return 'text-green-400';
  return 'text-blue-400';
}

export function getPermissionName(permission: string): string {
  const names: Record<string, string> = {
    'Administrator': 'مدير',
    'ManageGuild': 'إدارة السيرفر',
    'ManageChannels': 'إدارة القنوات',
    'ManageRoles': 'إدارة الرولات',
    'ManageMessages': 'إدارة الرسائل',
    'KickMembers': 'طرد الأعضاء',
    'BanMembers': 'حظر الأعضاء',
    'ModerateMembers': 'إدارة الأعضاء',
    'ManageNicknames': 'إدارة الألقاب',
    'ManageEmojisAndStickers': 'إدارة الإيموجي والملصقات',
    'ManageWebhooks': 'إدارة الويب هوك',
    'ViewAuditLog': 'عرض سجل التدقيق',
    'ViewChannel': 'عرض القنوات',
    'SendMessages': 'إرسال الرسائل',
    'SendTTSMessages': 'إرسال رسائل TTS',
    'ManageThreads': 'إدارة الثريدات',
    'CreatePublicThreads': 'إنشاء ثريدات عامة',
    'CreatePrivateThreads': 'إنشاء ثريدات خاصة',
    'UseExternalEmojis': 'استخدام إيموجي خارجية',
    'ViewGuildInsights': 'عرض إحصائيات السيرفر',
    'Connect': 'الاتصال بالصوت',
    'Speak': 'التحدث',
    'MuteMembers': 'كتم الأعضاء',
    'DeafenMembers': 'إصماء الأعضاء',
    'MoveMembers': 'نقل الأعضاء',
    'UseVAD': 'استخدام كشف الصوت',
    'ChangeNickname': 'تغيير اللقب',
    'ManageNicknames': 'إدارة الألقاب',
    'ManageRoles': 'إدارة الرولات',
    'ManageWebhooks': 'إدارة الويب هوك',
    'ManageEmojisAndStickers': 'إدارة الإيموجي والملصقات',
    'UseApplicationCommands': 'استخدام أوامر التطبيق',
    'RequestToSpeak': 'طلب التحدث',
    'ManageEvents': 'إدارة الأحداث',
    'ManageThreads': 'إدارة الثريدات',
    'CreatePublicThreads': 'إنشاء ثريدات عامة',
    'CreatePrivateThreads': 'إنشاء ثريدات خاصة',
    'UseExternalStickers': 'استخدام ملصقات خارجية',
    'SendMessagesInThreads': 'إرسال رسائل في الثريدات',
    'UseEmbeddedActivities': 'استخدام الأنشطة المضمنة',
    'ModerateMembers': 'إدارة الأعضاء (كتم/طرد)',
  };
  return names[permission] || permission;
}