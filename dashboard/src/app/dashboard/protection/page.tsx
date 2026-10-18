'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, ShieldAlert, ShieldCheck, Bot, Zap, Link, 
  MessageSquare, Megaphone, Type, Smile, Bot as BotIcon,
  AlertTriangle, RotateCcw, HardDrive, Search, Trash2,
  ToggleLeft, ToggleRight, Plus, Minus, List, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const protectionFeatures = [
  { id: 'antiRaid', name: 'مكافحة الرويد', desc: 'يحمي من الانضمام السريع', icon: Users, color: 'text-blue-400', category: 'basic' },
  { id: 'antiSpam', name: 'مكافحة السبام', desc: 'يوقف تكرار الرسائل', icon: MessageSquare, color: 'text-green-400', category: 'basic' },
  { id: 'antiLink', name: 'مكافحة الروابط', desc: 'يمنع الروابط الخارجية', icon: Link, color: 'text-purple-400', category: 'basic' },
  { id: 'antiInvite', name: 'مكافحة الدعوات', desc: 'يمنع روابط الدعوة', icon: Mail, color: 'text-orange-400', category: 'basic' },
  { id: 'antiMention', name: 'مكافحة المنشنز', desc: 'يمنع المنشن الجماعي', icon: Megaphone, color: 'text-red-400', category: 'basic' },
  { id: 'antiCaps', name: 'مكافحة الكابس', desc: 'يمنع الحروف الكبيرة', icon: Type, color: 'text-yellow-400', category: 'basic' },
  { id: 'antiEmoji', name: 'مكافحة الإيموجي', desc: 'يمنع الإيموجي المتكرر', icon: Smile, color: 'text-pink-400', category: 'basic' },
  { id: 'antiNuke', name: 'مضاد النيوك', desc: 'يوقف الحذف الجماعي ويعاقب المخالف', icon: ShieldAlert, color: 'text-red-500', category: 'advanced' },
  { id: 'antiBot', name: 'مضاد البوتات', desc: 'يطرد البوتات غير المصرح بها', icon: BotIcon, color: 'text-cyan-400', category: 'advanced' },
  { id: 'antiAdmin', name: 'مراقبة الصلاحيات', desc: 'تنبيه فوري عند منح أدمن', icon: AlertTriangle, color: 'text-orange-400', category: 'advanced' },
  { id: 'autoBackup', name: 'نسخ احتياطي تلقائي', desc: 'يحفظ بنية السيرفر ويستعيدها', icon: HardDrive, color: 'text-blue-400', category: 'advanced' },
  { id: 'autoScan', name: 'فحص دوري', desc: 'يمسح رومات/رولات الهاكر ويرجّع الناقص', icon: Search, color: 'text-indigo-400', category: 'advanced' },
  { id: 'scamFilter', name: 'فلتر الاحتيال', desc: 'يحذف روابط الصيد والمشاريع المزيفة', icon: ShieldCheck, color: 'text-green-500', category: 'advanced' },
  { id: 'antiAlt', name: 'Anti-Alt Detection', desc: 'يكشف الحسابات البديلة', icon: Users, color: 'text-purple-500', category: 'new' },
  { id: 'inviteTracker', name: 'Invite Tracker', desc: 'يتتبع الدعوات ويكشف المشبوهة', icon: Mail, color: 'text-orange-500', category: 'new' },
  { id: 'messageScanner', name: 'Message Scanner', desc: 'يفحص روابط/ملفات بـ VirusTotal', icon: Search, color: 'text-teal-400', category: 'new' },
  { id: 'aiAutoMod', name: 'AI Auto-Moderation', desc: 'يقرأ كل رسالة ويقرر: سبام/سم/إباحي/احتيال', icon: Bot, color: 'text-purple-600', category: 'ai' },
  { id: 'aiTicketAssistant', name: 'AI Ticket Assistant', desc: 'يستلم التذكرة، يحلل، يحل، يطلب موافقة أدمن', icon: Bot, color: 'text-pink-500', category: 'ai' },
  { id: 'aiTranslator', name: 'AI Translator', desc: 'ترجمة فورية مع كشف اللغة التلقائي', icon: Globe, color: 'text-cyan-500', category: 'ai' },
];

export default function ProtectionPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/dashboard/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (featureId: string, enabled: boolean) => {
    // Optimistic update
    setSettings(prev => {
      if (!prev) return prev;
      const path = getFeaturePath(featureId);
      if (!path) return prev;
      const newSettings = JSON.parse(JSON.stringify(prev));
      setNestedValue(newSettings, path, { ...getNestedValue(newSettings, path), enabled });
      return newSettings;
    });

    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId, enabled }),
        credentials: 'include',
      });
    } catch (error) {
      // Rollback on error
      fetchSettings();
    }
  };

  const getFeaturePath = (featureId: string) => {
    const paths: Record<string, string> = {
      antiRaid: 'protection.antiRaid',
      antiSpam: 'protection.antiSpam',
      antiLink: 'protection.antiLink',
      antiInvite: 'protection.antiInvite',
      antiMention: 'protection.antiMention',
      antiCaps: 'protection.antiCaps',
      antiEmoji: 'protection.antiEmoji',
      antiNuke: 'protection.antiNuke',
      antiBot: 'protection.antiBot',
      antiAdmin: 'protection.antiAdmin',
      autoBackup: 'protection.autoBackup',
      autoScan: 'protection.autoScan',
      scamFilter: 'protection.scamFilter',
      antiAlt: 'protection.antiAlt',
      inviteTracker: 'protection.inviteTracker',
      messageScanner: 'protection.messageScanner',
      aiAutoMod: 'protection.aiAutoMod',
      aiTicketAssistant: 'protection.aiTicketAssistant',
      aiTranslator: 'protection.aiTranslator',
    };
    return paths[featureId];
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  };

  const setNestedValue = (obj: any, path: string, value: any) => {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  };

  const featuresByCategory = {
    basic: protectionFeatures.filter(f => f.category === 'basic'),
    advanced: protectionFeatures.filter(f => f.category === 'advanced'),
    new: protectionFeatures.filter(f => f.category === 'new'),
    ai: protectionFeatures.filter(f => f.category === 'ai'),
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">نظام الحماية</h1>
            <p className="text-gray-400 mt-1">إدارة جميع ميزات الحماية والأمان</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="card animate-pulse">
              <Skeleton variant="rectangular" width="100%" height={200} className="mb-4" />
              <div className="space-y-3 px-2">
                <Skeleton width="60%" height={24} />
                <Skeleton width="40%" height={16} />
                <Skeleton width="80%" height={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">نظام الحماية</h1>
          <p className="text-gray-400 mt-1">إدارة جميع ميزات الحماية والأمان للسيرفر</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">تصدير الإعدادات</button>
          <button className="btn-primary">حفظ الكل</button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6" role="tablist">
        {[
          { id: 'basic', label: 'أساسية', count: Object.keys(featuresByCategory.basic).length },
          { id: 'advanced', label: 'متقدمة', count: Object.keys(featuresByCategory.advanced).length },
          { id: 'new', label: 'جديدة', count: Object.keys(featuresByCategory.new).length },
          { id: 'ai', label: 'AI', count: Object.keys(featuresByCategory.ai).length },
        ].map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-liberty-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-liberty-border'
            )}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 text-xs bg-liberty-border rounded-full">
              {protectionFeatures.filter(f => f.category === tab.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {protectionFeatures
          .filter(f => f.category === activeTab)
          .map(feature => {
            const featureSettings = settings?.protection?.[feature.id] || { enabled: false };
            const path = getFeaturePath(feature.id);
            const isEnabled = path ? getNestedValue(settings, path)?.enabled : false;

            return (
              <div 
                key={feature.id} 
                className={cn(
                  'card-hover group relative',
                  isEnabled ? 'border-liberty-primary/30' : 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                      `bg-${feature.color.replace('text-', 'bg-')}/20`
                    )}>
                      <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{feature.name}</h3>
                      <p className="text-sm text-gray-400">{feature.desc}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={isEnabled}
                    onChange={(checked) => handleToggle(feature.id, checked)}
                    size="md"
                    aria-label={feature.name}
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-liberty-border/50">
                  <span className={cn('badge', isEnabled ? 'badge-success' : 'badge-outline')}>
                    {isEnabled ? 'مفعّل' : 'معطّل'}
                  </span>
                  {feature.category === 'advanced' && (
                    <Badge variant="outline" className="text-xs">متقدم</Badge>
                  )}
                  {feature.category === 'ai' && (
                    <Badge variant="info" className="text-xs">AI</Badge>
                  )}
                  {feature.category === 'new' && (
                    <Badge variant="warning" className="text-xs">جديد</Badge>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Whitelist Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">القائمة البيضاء (Whitelist)</h2>
          <div className="flex gap-3">
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              إضافة عضو
            </button>
          </div>
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-liberty-border">
                  <th className="px-4 py-3 text-left font-semibold text-gray-400">العضو</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-400">السبب</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-400">مضافة بواسطة</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-400">التاريخ</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-400">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {settings?.protection?.whitelist?.userIds?.map((userId: string, i: number) => (
                  <tr key={userId} className="border-b border-liberty-border/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={`User ${i+1}`} size="sm" />
                        <span className="font-medium text-white">User {i+1}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">مطور البوت</td>
                    <td className="px-4 py-3 text-gray-400">النظام</td>
                    <td className="px-4 py-3 text-gray-400">اليوم</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-liberty-error hover:text-red-400 text-sm">
                        إزالة
                      </button>
                    </td>
                  </tr>
                ))}
                {(!settings?.protection?.whitelist?.userIds?.length) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      القائمة البيضاء فارغة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProtectionPage;