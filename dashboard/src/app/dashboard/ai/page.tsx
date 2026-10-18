'use client';

import { useState, useEffect } from 'react';
import { 
  Bot, BotMessageSquare, MessageSquare, Languages, 
  Sliders, ToggleLeft, ToggleRight, Zap, Shield,
  Plus, Edit, Trash2, TestTube, Brain, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const aiFeatures = [
  { 
    id: 'autoMod', 
    name: 'AI Auto-Moderation', 
    desc: 'يقرأ كل رسالة، يقرر: سبام/سم/إباحي/احتيال/تهديد/تسريب/رائد/إيذاء النفس', 
    icon: Shield, 
    color: 'text-red-500',
    settings: [
      { key: 'sensitivity', label: 'الحساسية', type: 'number', min: 1, max: 10 },
      { key: 'muteDuration', label: 'مدة الكتم (دقيقة)', type: 'number' },
      { key: 'escalation', label: 'تصعيد تلقائي', type: 'boolean' },
      { key: 'maxWarningsBeforeEscalation', label: 'تحذيرات قبل التصعيد', type: 'number' },
    ]
  },
  { 
    id: 'ticketAssistant', 
    name: 'AI Ticket Assistant', 
    desc: 'يستلم التذكرة، يحلل، يحل، يطلب موافقة أدمن للإجراءات الحساسة (رول/حظر/صلاحية)', 
    icon: MessageSquare, 
    color: 'text-purple-500',
    settings: [
      { key: 'autoClaim', label: 'استلام تلقائي', type: 'boolean' },
      { key: 'analyzeOnCreate', label: 'تحليل عند الإنشاء', type: 'boolean' },
      { key: 'requireAdminApprovalForRoles', label: 'موافقة للرولات', type: 'boolean' },
      { key: 'requireAdminApprovalForPermissions', label: 'موافقة للصلاحيات', type: 'boolean' },
      { key: 'requireAdminApprovalForBans', label: 'موافقة للحظر', type: 'boolean' },
      { key: 'confidenceThreshold', label: 'حد الثقة (%)', type: 'number', min: 0, max: 100 },
    ]
  },
  { 
    id: 'translator', 
    name: 'AI Translator', 
    desc: 'ترجمة فورية مع كشف اللغة التلقائي، 50+ لغة، /translate command', 
    icon: Globe, 
    color: 'text-cyan-500',
    settings: [
      { key: 'defaultTargetLang', label: 'اللغة الهدف الافتراضية', type: 'select', options: [
        { value: 'ar', label: 'العربية' },
        { value: 'en', label: 'English' },
        { value: 'fr', label: 'French' },
        { value: 'es', label: 'Español' },
        { value: 'de', label: 'Deutsch' },
        { value: 'tr', label: 'Türkçe' },
        { value: 'fa', label: 'فارسی' },
        { value: 'auto', label: 'Auto' },
      ]},
      { key: 'showOriginal', label: 'إظهار النص الأصلي', type: 'boolean' },
      { key: 'maxLength', label: 'الحد الأقصى للطول', type: 'number' },
    ]
  },
];

export default function AIPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

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

  const getFeatureSettings = (featureId: string) => {
    const paths: Record<string, string> = {
      autoMod: 'protection.aiAutoMod',
      ticketAssistant: 'protection.aiTicketAssistant',
      translator: 'protection.aiTranslator',
    };
    const path = paths[featureId];
    if (!path || !settings) return {};
    return path.split('.').reduce((o, k) => o?.[k], settings) || {};
  };

  const updateFeatureSetting = async (featureId: string, key: string, value: any) => {
    const featureSettings = getFeatureSettings(featureId);
    const newFeatureSettings = { ...featureSettings, [key]: value };
    
    // Optimistic update
    setSettings(prev => {
      if (!prev) return prev;
      const newSettings = JSON.parse(JSON.stringify(prev));
      const path = featureId === 'autoMod' ? 'protection.aiAutoMod' : 
                   featureId === 'ticketAssistant' ? 'protection.aiTicketAssistant' :
                   'protection.aiTranslator';
      setNestedValue(newSettings, path, newFeatureSettings);
      return newSettings;
    });

    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: featureId, settings: newFeatureSettings }),
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">الذكاء الاصطناعي</h1>
            <p className="text-gray-400 mt-1">إدارة ميزات AI: Auto-Mod، Ticket Assistant، Translator</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse h-64"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">الذكاء الاصطناعي</h1>
          <p className="text-gray-400 mt-1">إدارة ميزات AI: Auto-Mod، Ticket Assistant، Translator</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">تصدير إعدادات AI</button>
          <button className="btn-primary">حفظ إعدادات AI</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aiFeatures.map(feature => {
          const featureSettings = getFeatureSettings(feature.id);
          const isEnabled = featureSettings.enabled || false;

          return (
            <div 
              key={feature.id} 
              className={cn(
                'card-hover relative overflow-hidden',
                isEnabled ? 'border-l-4 border-l-' + feature.color.replace('text-', '') : 'opacity-60'
              )}
            >
              <div className="absolute top-0 right-0 w-1 h-full" style={{ backgroundColor: feature.color.replace('text-', '') }} />
              <div className="p-6">
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
                    onChange={(checked) => {
                      updateFeatureSetting(feature.id, 'enabled', checked);
                    }}
                    size="md"
                  />
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-white mb-3">الإعدادات:</h4>
                  <div className="space-y-3">
                    {feature.settings.map(setting => {
                      const value = featureSettings[setting.key] ?? (setting.type === 'boolean' ? false : setting.type === 'number' ? 0 : '');
                      
                      if (setting.type === 'boolean') {
                        return (
                          <div key={setting.key} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-white">{setting.label}</p>
                            </div>
                            <Toggle
                              checked={value}
                              onChange={(checked) => updateFeatureSetting(feature.id, setting.key, checked)}
                              size="md"
                            />
                          </div>
                        );
                      }
                      
                      if (setting.type === 'number') {
                        return (
                          <div key={setting.key} className="flex items-center gap-3">
                            <label className="label w-48">{setting.label}</label>
                            <Input
                              type="number"
                              value={value}
                              onChange={(e) => updateFeatureSetting(feature.id, setting.key, parseInt(e.target.value) || 0)}
                              min={setting.min}
                              max={setting.max}
                              className="w-32"
                            />
                            {setting.min !== undefined && setting.max !== undefined && (
                              <span className="text-sm text-gray-500">({setting.min} - {setting.max})</span>
                            )}
                          </div>
                        );
                      }
                      
                      if (setting.type === 'select') {
                        return (
                          <div key={setting.key} className="flex items-center gap-3">
                            <label className="label w-48">{setting.label}</label>
                            <Select
                              value={value}
                              onChange={(val) => updateFeatureSetting(feature.id, setting.key, val)}
                              options={setting.options.map(o => ({ value: o.value, label: o.label }))}
                              className="w-48"
                            />
                          </div>
                        );
                      }
                      
                      return null;
                    })}
                  </div>
                </div>

                {isEnabled && (
                  <div className="pt-4 border-t border-liberty-border/50">
                    <button 
                      className="btn-primary w-full"
                      onClick={() => testFeature(feature.id)}
                    >
                      <TestTube className="w-4 h-4 mr-2" />
                      اختبار الميزة
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* AI Personality & Custom Settings */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-500" />
                شخصية البوت
              </CardTitle>
              <CardDescription>خصص شخصية البوت وأسلوب الرد</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="الشخصية المخصصة"
                placeholder="مثال: أنت مساعد ذكي مرح، تتكلم بالعربية الفصحى المبسطة، تستخدم الإيموجي باعتدال..."
                value={settings?.ai?.customPersonality || ''}
                onChange={(e) => updateAISetting('customPersonality', e.target.value)}
                rows={4}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">لغة الردود</label>
                  <Select
                    value={settings?.ai?.responseLanguage || 'ar'}
                    onChange={(val) => updateAISetting('responseLanguage', val)}
                    options={[
                      { value: 'ar', label: '🇸🇦 العربية' },
                      { value: 'en', label: '🇺🇸 English' },
                      { value: 'both', label: '🌐 كلاهما' },
                    ]}
                  />
                </div>
                <div>
                  <label className="label">مستوى الإبداع (Temperature)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={settings?.ai?.temperature || 0.7}
                    onChange={(e) => updateAISetting('temperature', parseFloat(e.target.value) || 0.7)}
                  />
                </div>
                <div>
                  <label className="label">الحد الأقصى للتوكنز</label>
                  <Input
                    type="number"
                    value={settings?.ai?.maxTokens || 500}
                    onChange={(e) => updateAISetting('maxTokens', parseInt(e.target.value) || 500)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  أوامر AI المخصصة
                </CardTitle>
                <CardDescription>أضف أوامر AI مخصصة يستدعيها الأعضاء</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="كلمة المفتاح (مثال: /ask)" className="w-32" />
                    <Input placeholder="البرومبت" className="flex-1" />
                    <Button variant="secondary" size="sm">إضافة</Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[
                      { trigger: '/ask', prompt: 'أنت مساعد ذكي...' },
                      { trigger: '/code', prompt: 'أنت مبرمج خبير...' },
                      { trigger: '/translate', prompt: 'ترجم للنص...' },
                    ].map((cmd, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-liberty-darker/50 rounded-lg">
                        <div>
                          <code className="text-liberty-primary">{cmd.trigger}</code>
                          <p className="text-sm text-gray-400 mt-1 truncate">{cmd.prompt}</p>
                        </div>
                        <button className="text-liberty-error hover:text-red-400 text-sm">حذف</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
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

export default AIPage;