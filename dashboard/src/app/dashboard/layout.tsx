'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Shield, Bot, MessageSquare, Settings, 
  Users, ShieldCheck, Brain, Globe, LogOut, Menu, X,
  ShieldAlert, BotMessageSquare, Languages, Crown,
  Activity, Settings2, ShieldCheck as ShieldCheckIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
  { name: 'الحماية', href: '/dashboard/protection', icon: ShieldAlert, badge: 'Pro' },
  { name: 'الذكاء الاصطناعي', href: '/dashboard/ai', icon: BotMessageSquare },
  { name: 'المترجم', href: '/dashboard/translator', icon: Languages },
  { name: 'التذاكر', href: '/dashboard/tickets', icon: MessageSquare },
  { name: 'الأعضاء', href: '/dashboard/members', icon: Users },
  { name: 'النشاط', href: '/dashboard/activity', icon: Activity },
  { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings2 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userGuilds, setUserGuilds] = useState<Array<{id: string, name: string, icon?: string, owner: boolean}>>([]);
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Fetch user's guilds
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    try {
      const res = await fetch('/api/user/guilds');
      if (res.ok) {
        const data = await res.json();
        setUserGuilds(data.guilds || []);
        if (data.guilds?.[0] && !selectedGuild) {
          setSelectedGuild(data.guilds[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch guilds:', error);
    }
  };

  const handleGuildChange = (guildId: string) => {
    setSelectedGuild(guildId);
    router.push(pathname.replace(/\/dashboard\/[^/]+/, `/dashboard/${guildId}`));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-liberty-dark">
        <div className="glass-strong rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-liberty-primary to-liberty-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Liberty City Dashboard</h1>
          <p className="text-gray-400 mb-6">يجب تسجيل الدخول عبر Discord للوصول للوحة التحكم</p>
          <a 
            href="/api/auth/discord"
            className="btn-primary w-full"
          >
            تسجيل الدخول بـ Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-liberty-dark">
      {/* Mobile sidebar overlay */}
      <div 
        className={cn('fixed inset-0 z-40 bg-black/50 transition-opacity', mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />

      {/* Sidebar */}
      <aside 
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-liberty-darker border-r border-liberty-border',
          'transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="القائمة الجانبية"
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-liberty-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-liberty-primary to-liberty-secondary rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg text-white hidden lg:block">Liberty City</span>
          </Link>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guild Selector */}
        {userGuilds.length > 0 && (
          <div className="p-4 border-b border-liberty-border">
            <label className="label">السيرفر</label>
            <select
              value={selectedGuild || userGuilds[0]?.id || ''}
              onChange={(e) => handleGuildChange(e.target.value)}
              className="input text-sm"
            >
              {userGuilds.map(guild => (
                <option key={guild.id} value={guild.id}>
                  {guild.name} {guild.owner && '👑'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="التنقل الرئيسي">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={selectedGuild ? `${item.href}/${selectedGuild}` : item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  'text-gray-400 hover:text-white hover:bg-liberty-border',
                  isActive && 'bg-liberty-primary/20 text-liberty-primary border-r-2 border-liberty-primary'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="font-medium">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto badge-warning text-xs">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-liberty-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-liberty-primary to-liberty-secondary flex items-center justify-center flex-shrink-0">
              {user?.avatar 
                ? <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="" className="w-10 h-10 rounded-full" />
                : <Crown className="w-5 h-5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">@{user?.discriminator || '0'}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-liberty-error transition-colors"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-liberty-primary to-liberty-secondary text-white shadow-lg flex items-center justify-center"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="فتح القائمة"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <main 
        className={cn(
          'lg:ml-64 min-h-screen transition-all duration-300',
          'pb-20' // Space for mobile menu button
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;