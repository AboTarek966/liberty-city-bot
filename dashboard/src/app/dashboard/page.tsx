'use client';

import { useEffect, useState } from 'react';
import { 
  ShieldAlert, BotMessageSquare, Languages, MessageSquare, 
  Users, Activity, Settings2, Crown, TrendingUp,
  ShieldCheck, Bot, MessageSquare as MessageSquareIcon,
  Languages as LanguagesIcon
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const stats = [
  { name: 'السيرفرات', value: '0', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  { name: 'الرسائل المحمية', value: '0', icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-500/20' },
  { name: 'التذاكر المفتوحة', value: '0', icon: MessageSquareIcon, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { name: 'المستخدمين النشطين', value: '0', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/20' },
];

const quickActions = [
  { name: 'إعداد الحماية', href: '/dashboard/protection', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/20', desc: 'أنتينوك، أنتي سبام، أنتي الت' },
  { name: 'إعدادات الذكاء الاصطناعي', href: '/dashboard/ai', icon: Bot, color: 'text-purple-400', bg: 'bg-purple-500/20', desc: 'شخصية البوت، الردود التلقائية' },
  { name: 'إعدادات المترجم', href: '/dashboard/translator', icon: Languages, color: 'text-cyan-400', bg: 'bg-cyan-500/20', desc: 'اللغة الافتراضية، القنوات التلقائية' },
  { name: 'إدارة التذاكر', href: '/dashboard/tickets', icon: MessageSquareIcon, color: 'text-blue-400', bg: 'bg-blue-500/20', desc: 'فريق الدعم، أنواع التذاكر' },
];

export default function DashboardHome() {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState(stats);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStatsData(prev => prev.map((stat, i) => ({
          ...stat,
          value: data[stat.name] || stat.value
        })));
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">لوحة التحكم</h1>
          <p className="text-gray-400 mt-1">مرحباً بك، {user?.username || 'مدير'}! إدارة سيرفراتك من هنا.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">تصدير تقرير</button>
          <button className="btn-primary">تحديث البيانات</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat) => (
          <Link key={stat.name} href="#" className="card-hover">
            <div className="flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">إجراءات سريعة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link 
              key={action.name} 
              href={action.href}
              className="card-hover group"
            >
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4', action.bg)}>
                <action.icon className="w-6 h-6" style={{ color: action.color }} />
              </div>
              <h3 className="font-bold text-white mb-1">{action.name}</h3>
              <p className="text-sm text-gray-400">{action.desc}</p>
              <div className="mt-4 pt-4 border-t border-liberty-border flex items-center justify-between">
                <span className="text-sm text-gray-500">فتح الإعدادات</span>
                <span className="text-liberty-primary font-medium group-hover:translate-x-1 transition-transform">
                  ← دخول
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">نشاط حديث</h2>
          <Link href="/dashboard/activity" className="text-sm text-liberty-primary hover:text-cyan-300">
            عرض الكل →
          </Link>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-liberty-darker/50 rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">تم تفعيل مضاد النيوك</p>
              <p className="text-sm text-gray-400">في السيرفر الرئيسي</p>
            </div>
            <span className="text-xs text-gray-500">منذ 5 دقائق</span>
          </div>
          <div className="flex items-center gap-4 p-3 bg-liberty-darker/50 rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">تم تحديث شخصية البوت</p>
              <p className="text-sm text-gray-400">تم تغيير نمط الردود</p>
            </div>
            <span className="text-xs text-gray-500">منذ ساعة</span>
          </div>
          <div className="flex items-center gap-4 p-3 bg-liberty-darker/50 rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MessageSquareIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">تذكرة جديدة</p>
              <p className="text-sm text-gray-400">نوع: دعم فني</p>
            </div>
            <span className="text-xs text-gray-500">منذ 3 ساعات</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;