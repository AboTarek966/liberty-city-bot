'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, Shield, Bot, MessageSquare, Users, 
  Globe, ShieldCheck, Bell, Key, Palette, 
  Database, HardDrive, Cloud, Wrench, 
  Save, RotateCcw, Trash2, Plus, Eye, Edit
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Input';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';

const settingsCategories = [
  { id: 'general', label: 'عام', icon: Settings, description: 'الإعدادات الأساسية للسيرفر' },
  { id: 'protection', label: 'الحماية', icon: Shield, description: 'أنظمة الحماية والأمان' },
  { id: 'ai', label: 'الذكاء الاصطناعي', icon: Bot, description: 'إعدادات AI Auto-Mod، Ticket Assistant، Translator' },
  { id: 'tickets', label: 'التذاكر', icon: MessageSquare, description: 'نظام التذاكر والدعم الفني' },
  { id: 'members', label: 'الأعضاء', icon: Users, description: 'إدارة الأعضاء والأدوار' },
  { id: 'welcome', label: 'الترحيب', icon: Globe, description: 'رسائل الترحيب والمغادرة' },
  { id: 'logging', label: 'السجلات', icon: Database, description: 'إعدادات السجلات والتدقيق' },
  { id: 'economy', label: 'الاقتصاد', icon: Database, description: 'العملات، المتجر، المستويات' },
  { id: 'automod', label: 'الأوتو مود', icon: ShieldCheck, description: 'فلتر الكلمات، الروابط، السبام' },
  { id: 'verification', label: 'التوثيق', icon: ShieldCheck, description: 'نظام التوثيق بالزر' },
  { id: 'commands', label: 'الأوامر', icon: Wrench, description: 'الأوامر المخصصة والاختصارات' },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: HardDrive, description: 'إدارة النسخ الاحتياطية والاستعادة' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);

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

  const updateSetting = async (path: string, value: any) => {
    setSettings(prev => {
      if (!prev) return prev;
      const newSettings = JSON.parse(JSON.stringify(prev));
      setNestedValue(newSettings, path, value);
      return newSettings;
    });

    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, value }),
        credentials: 'include',
      });
    } catch (error) {
      fetchSettings();
    }
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

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveAll', settings }),
        credentials: 'include',
      });
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">الإعدادات</h1>
            <p className="text-gray-400 mt-1">إدارة جميع إعدادات البوت والسيرفر</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">الإعدادات</h1>
          <p className="text-gray-400 mt-1">إدارة جميع إعدادات البوت والسيرفر</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => fetchSettings()}>
            <RotateCcw className="w-4 h-4 mr-2" />
            تحديث
          </Button>
          <Button variant="secondary" onClick={handleSaveAll} disabled={saving}>
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                حفظ جميع التغييرات
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 lg:w-72 flex-shrink-0">
          <Card className="card-hover h-fit sticky top-6">
            <CardContent className="p-4">
              <nav className="space-y-1" role="navigation" aria-label="إعدادات">
                {settingsCategories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      'text-left',
                      activeTab === category.id
                        ? 'bg-liberty-primary/20 text-liberty-primary border-r-2 border-liberty-primary'
                        : 'text-gray-400 hover:text-white hover:bg-liberty-border'
                    )}
                    role="tab"
                    aria-selected={activeTab === category.id}
                  >
                    <category.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{category.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'general' && <GeneralSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'protection' && <ProtectionSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'ai' && <AISettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'tickets' && <TicketsSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'members' && <MembersSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'welcome' && <WelcomeSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'logging' && <LoggingSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'economy' && <EconomySettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'automod' && <AutoModSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'verification' && <VerificationSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'commands' && <CommandsSettings settings={settings} onChange={updateSetting} />}
          {activeTab === 'backup' && <BackupSettings settings={settings} onChange={updateSetting} />}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  const prefix = settings?.prefix || 'lc!';
  const language = settings?.language || 'ar';
  const timezone = settings?.timezone || 'Asia/Riyadh';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">الإعدادات العامة</h2>
        <Badge variant="info">أساسي</Badge>
      </div>

      <Card className="card-hover">
        <CardHeader>
          <CardTitle>معلومات السيرفر الأساسية</CardTitle>
          <CardDescription>الإعدادات الأساسية التي تؤثر على جميع ميزات البوت</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">بادئة الأوامر (Prefix)</label>
              <Input
                value={prefix}
                onChange={(e) => updateSetting('prefix', e.target.value)}
                placeholder="lc!"
                maxLength={5}
              />
              <p className="text-xs text-gray-500 mt-1">البادئة المستخدمة للأوامر النصية (مثال: lc!help)</p>
            </div>
            <div>
              <label className="label">اللغة الافتراضية</label>
              <Select
                value={language}
                onChange={(val) => updateSetting('language', val)}
                options={[
                  { value: 'ar', label: '🇸🇦 العربية' },
                  { value: 'en', label: '🇺🇸 English' },
                ]}
              />
            </div>
            <div>
              <label className="label">المنطقة الزمنية</label>
              <Select
                value={timezone}
                onChange={(val) => updateSetting('timezone', val)}
                options={[
                  { value: 'Asia/Riyadh', label: '🇸🇦 الرياض (UTC+3)' },
                  { value: 'Asia/Dubai', label: '🇦🇪 دبي (UTC+4)' },
                  { value: 'Asia/Kuwait', label: '🇰🇼 الكويت (UTC+3)' },
                  { value: 'Asia/Baghdad', label: '🇮🇶 بغداد (UTC+3)' },
                  { value: 'Africa/Cairo', label: '🇪🇬 القاهرة (UTC+2)' },
                  { value: 'UTC', label: '🌍 UTC (توقيت عالمي)' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader>
          <CardTitle>إعدادات البوت</CardTitle>
          <CardDescription>إعدادات عامة لسلوك البوت</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">حالة البوت</p>
              <p className="text-sm text-gray-500">تفعيل/تعطيل البوت بالكامل</p>
            </div>
            <Toggle
              checked={settings?.bot?.enabled !== false}
              onChange={(checked) => updateSetting('bot.enabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">الرد على المنشن</p>
              <p className="text-sm text-gray-500">البوت يرد عند عمل منشن له</p>
            </div>
            <Toggle
              checked={settings?.bot?.replyOnMention !== false}
              onChange={(checked) => updateSetting('bot.replyOnMention', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">الرد على الردود</p>
              <p className="text-sm text-gray-500">البوت يرد عند الرد على رسائله</p>
            </div>
            <Toggle
              checked={settings?.bot?.replyOnReply !== false}
              onChange={(checked) => updateSetting('bot.replyOnReply', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">حالة البوت (Status)</p>
            </div>
            <Input
              value={settings?.bot?.status || 'Liberty City'}
              onChange={(e) => updateSetting('bot.status', e.target.value)}
              placeholder="Liberty City"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProtectionSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  // Reuse the protection settings from ProtectionPage
  return (
    <div className="space-y-4">
      <p className="text-gray-400">إعدادات الحماية متاحة في تبويب <strong>الحماية</strong> في القائمة الجانبية</p>
    </div>
  );
}

function AISettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-gray-400">إعدادات AI متاحة في تبويب <strong>الذكاء الاصطناعي</strong> في القائمة الجانبية</p>
    </div>
  );
}

function TicketsSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-gray-400">إعدادات التذاكر متاحة في تبويب <strong>التذاكر</strong> في القائمة الجانبية</p>
    </div>
  );
}

function MembersSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-gray-400">إعدادات الأعضاء متاحة في تبويب <strong>الأعضاء</strong> في القائمة الجانبية</p>
    </div>
  );
}

function WelcomeSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  const welcome = settings?.welcome || {};
  
  return (
    <div className="space-y-6">
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>رسائل الترحيب</CardTitle>
          <CardDescription>إعداد رسائل الترحيب عند انضمام أعضاء جدد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">تفعيل رسائل الترحيب</p>
              <p className="text-sm text-gray-500">إرسال رسالة ترحيب عند انضمام عضو جديد</p>
            </div>
            <Toggle
              checked={welcome.enabled || false}
              onChange={(checked) => updateSetting('welcome.enabled', checked)}
            />
          </div>

          <div>
            <label className="label">قناة الترحيب</label>
            <Input
              placeholder="ID القناة أو منشن"
              value={welcome.channelId || ''}
              onChange={(e) => updateSetting('welcome.channelId', e.target.value)}
            />
          </div>

          <div>
            <label className="label">رسالة الترحيب</label>
            <Textarea
              value={welcome.message || 'مرحباً {user}! أهلاً بك في {server}. أنت العضو رقم {count} 🎉'}
              onChange={(e) => updateSetting('welcome.message', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">المتغيرات: {user}, {user.name}, {user.mention}, {server}, {count}, {member.count}</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">رسالة خاصة (DM)</p>
              <p className="text-sm text-gray-500">إرسال رسالة ترحيب في الخاص للعضو الجديد</p>
            </div>
            <Toggle
              checked={welcome.dmEnabled || false}
              onChange={(checked) => updateSetting('welcome.dmEnabled', checked)}
            />
          </div>

          <div>
            <label className="label">رسالة الخاص (DM)</label>
            <Textarea
              value={welcome.dmMessage || 'مرحباً بك في {server}! نتمنى لك وقتاً ممتعاً.'}
              onChange={(e) => updateSetting('welcome.dmMessage', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">بطاقة ترحيب مرسومة (ProBot Style)</p>
              <p className="text-sm text-gray-500">بطاقة ترحيب مصورة مع خلفية مخصصة</p>
            </div>
            <Toggle
              checked={welcome.card?.enabled || false}
              onChange={(checked) => {
                if (!welcome.card) welcome.card = {};
                updateSetting('welcome.card.enabled', checked);
              }}
            />
          </div>
        </Card>

        <Card className="card-hover">
          <CardHeader>
            <CardTitle>رسائل المغادرة</CardTitle>
            <CardDescription>إعداد رسائل الوداع عند مغادرة أعضاء</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">تفعيل رسائل المغادرة</p>
                <p className="text-sm text-gray-500">إرسال رسالة عند مغادرة عضو</p>
              </div>
              <Toggle
                checked={settings?.leave?.enabled || false}
                onChange={(checked) => updateSetting('leave.enabled', checked)}
              />
            </div>

            <div>
              <label className="label">قناة المغادرة</label>
              <Input
                placeholder="ID القناة"
                value={settings?.leave?.channelId || ''}
                onChange={(e) => updateSetting('leave.channelId', e.target.value)}
              />
            </div>

            <div>
              <label className="label">رسالة المغادرة</label>
              <Textarea
                value={settings?.leave?.message || 'وداعاً {user}! نتمنى لك التوفيق.'}
                onChange={(e) => updateSetting('leave.message', e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  );
}

function LoggingSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  const logging = settings?.logging || {};
  
  return (
    <div className="space-y-6">
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>إعدادات السجلات</CardTitle>
          <CardDescription>تكوين قنوات وأنواع السجلات</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">تفعيل السجلات</p>
              <p className="text-sm text-gray-500">تسجيل الأحداث في قناة مخصصة</p>
            </div>
            <Toggle
              checked={logging.enabled || false}
              onChange={(checked) => updateSetting('logging.enabled', checked)}
            />
          </div>

          <div>
            <label className="label">قناة السجلات الرئيسية</label>
            <Input
              placeholder="ID قناة السجلات"
              value={logging.channelId || ''}
              onChange={(e) => updateSetting('logging.channelId', e.target.value)}
            />
          </div>

          <div>
            <label className="label">أنواع الأحداث المراد تسجيلها</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {[
                { key: 'messageDelete', label: 'حذف الرسائل' },
                { key: 'messageUpdate', label: 'تعديل الرسائل' },
                { key: 'memberJoin', label: 'انضمام أعضاء' },
                { key: 'memberLeave', label: 'مغادرة أعضاء' },
                { key: 'roleCreate', label: 'إنشاء رولات' },
                { key: 'roleDelete', label: 'حذف رولات' },
                { key: 'channelCreate', label: 'إنشاء قنوات' },
                { key: 'channelDelete', label: 'حذف قنوات' },
                { key: 'banAdd', label: 'حظر أعضاء' },
                { key: 'banRemove', label: 'إلغاء حظر' },
                { key: 'voiceStateUpdate', label: 'تغيير حالة الصوت' },
              ].map(event => (
                <label key={event.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logging.types?.includes(event.key) || false}
                    onChange={(e) => {
                      const newTypes = logging.types || [];
                      if (e.target.checked) {
                        updateSetting('logging.types', [...newTypes, event.key]);
                      } else {
                        updateSetting('logging.types', newTypes.filter(t => t !== event.key));
                      }
                    }}
                    className="w-4 h-4 rounded border-liberty-border text-liberty-primary focus:ring-liberty-primary"
                  />
                  <span className="text-sm text-gray-300">{event.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EconomySettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  return (
    <div className="space-y-4">
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>نظام الاقتصاد</CardTitle>
          <CardDescription>إعدادات العملات، المتجر، التحويلات</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">إعدادات الاقتصاد ستضاف قريباً...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AutoModSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-gray-400">إعدادات الأوتو مود متاحة في تبويب <strong>الحماية</strong></p>
    </div>
  );
}

function VerificationSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  const verification = settings?.verification || {};
  
  return (
    <div className="space-y-6">
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>نظام التوثيق بالزر</CardTitle>
          <CardDescription>عضو يضغط زر → يحصل على رول التوثيق</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">تفعيل التوثيق</p>
              <p className="text-sm text-gray-500">تفعيل نظام التوثيق بالزر</p>
            </div>
            <Toggle
              checked={verification.enabled || false}
              onChange={(checked) => updateSetting('verification.enabled', checked)}
            />
          </div>

          <div>
            <label className="label">رول التوثيق</label>
            <Input
              placeholder="ID رول التوثيق"
              value={verification.roleId || ''}
              onChange={(e) => updateSetting('verification.roleId', e.target.value)}
            />
          </div>

          <div>
            <label className="label">قناة التوثيق</label>
            <Input
              placeholder="ID قناة التوثيق"
              value={verification.channelId || ''}
              onChange={(e) => updateSetting('verification.channelId', e.target.value)}
            />
          </div>

          <div>
            <label className="label">نص الزر</label>
            <Input
              value={verification.buttonText || '✅ توثيق الحساب'}
              onChange={(e) => updateSetting('verification.buttonText', e.target.value)}
            />
          </div>

          <div>
            <label className="label">رسالة التوثيق</label>
            <Textarea
              value={verification.message || 'اضغط الزر أدناه للحصول على رول التوثيق والوصول للسيرفر'}
              onChange={(e) => updateSetting('verification.message', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommandsSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  return (
    <div className="space-y-4">
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>الأوامر المخصصة</CardTitle>
          <CardDescription>إدارة الأوامر النصية المخصصة والاختصارات</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">إدارة الأوامر المخصصة ستضاف قريباً...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function BackupSettings({ settings, onChange }: { settings: any; onChange: (path: string, value: any) => void }) {
  const backup = settings?.protection?.autoBackup || {};
  
  return (
    <div className="space-y-6">
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>النسخ الاحتياطي التلقائي</CardTitle>
          <CardDescription>حفظ بنية السيرفر دورياً للاستعادة عند الحاجة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">تفعيل النسخ التلقائي</p>
              <p className="text-sm text-gray-500">إنشاء نسخة احتياطية دورية لبنية السيرفر</p>
            </div>
            <Toggle
              checked={backup.enabled || false}
              onChange={(checked) => updateSetting('protection.autoBackup.enabled', checked)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">فترة النسخ (ساعات)</label>
              <Select
                value={backup.interval || 6}
                onChange={(val) => updateSetting('protection.autoBackup.interval', parseInt(val))}
                options={[
                  { value: '1', label: 'كل ساعة' },
                  { value: '3', label: 'كل 3 ساعات' },
                  { value: '6', label: 'كل 6 ساعات' },
                  { value: '12', label: 'كل 12 ساعة' },
                  { value: '24', label: 'يومياً' },
                ]}
              />
            </div>
            <div>
              <label className="label">عدد النسخ المحتفظ بها</label>
              <Select
                value={backup.keep || 5}
                onChange={(val) => updateSetting('protection.autoBackup.keep', parseInt(val))}
                options={[
                  { value: '3', label: '3 نسخ' },
                  { value: '5', label: '5 نسخ' },
                  { value: '10', label: '10 نسخ' },
                  { value: '20', label: '20 نسخة' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">نسخ فوري الآن</p>
              <p className="text-sm text-gray-500">إنشاء نسخة احتياطية فورية</p>
            </div>
            <Button variant="primary" onClick={() => createBackup()}>
              <Database className="w-4 h-4 mr-2" />
              إنشاء نسخة الآن
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader>
          <CardTitle>النسخ المحفوظة</CardTitle>
          <CardDescription>قائمة النسخ الاحتياطية المتاحة للاستعادة</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">قائمة النسخ الاحتياطية ستظهر هنا...</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function createBackup() {
  try {
    await fetch('/api/dashboard/backup/create', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Backup failed:', error);
  }
}

function updateSetting(path: string, value: any) {
  // This will be passed from parent
  console.log('Update setting:', path, value);
}

function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

export default SettingsPage;