'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, MoreVertical, Shield, 
  Ban, UserPlus, UserMinus, Mail, Phone, 
  Award, Activity, Clock, Download, ShieldCheck,
  Trash2, Edit, Eye, Flag, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Avatar, RoleBadge } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';

const mockMembers = [
  { id: '1', username: 'Ahmed#1234', displayName: 'أحمد', avatar: null, joinedAt: '2023-01-15', roles: ['Admin', 'Moderator'], status: 'online', warnings: 0, isBot: false },
  { id: '2', username: 'Mohamed#5678', displayName: 'محمد', avatar: null, joinedAt: '2023-02-20', roles: ['Member', 'VIP'], status: 'idle', warnings: 1, isBot: false },
  { id: '3', username: 'Sarah#9999', displayName: 'سارة', avatar: null, joinedAt: '2023-03-10', roles: ['Member'], status: 'online', warnings: 0, isBot: false },
  { id: '4', username: 'Bot#0001', displayName: 'Liberty Bot', avatar: null, joinedAt: '2023-01-01', roles: ['Bot'], status: 'online', warnings: 0, isBot: true },
  { id: '5', username: 'Khaled#5555', displayName: 'خالد', avatar: null, joinedAt: '2023-04-05', roles: ['Member', 'VIP', 'Booster'], status: 'dnd', warnings: 2, isBot: false },
  { id: '6', username: 'NewUser#1111', displayName: 'مستخدم جديد', avatar: null, joinedAt: '2024-01-10', roles: ['Member'], status: 'offline', warnings: 0, isBot: false },
  { id: '7', username: 'Moderator#001', displayName: 'المشرف', avatar: null, joinedAt: '2023-01-01', roles: ['Admin', 'Moderator', 'Owner'], status: 'online', warnings: 0, isBot: false },
  { id: '8', username: 'Spammer#999', displayName: 'سبامر', avatar: null, joinedAt: '2024-01-12', roles: ['Member'], status: 'offline', warnings: 5, isBot: false },
];

export default function MembersPage() {
  const [members, setMembers] = useState(mockMembers);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('joinedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [viewingMember, setViewingMember] = useState<any>(null);

  const filteredMembers = members
    .filter(m => 
      (statusFilter === 'all' || m.status === statusFilter) &&
      (roleFilter === 'all' || m.roles.some(r => r.toLowerCase().includes(roleFilter.toLowerCase()))) &&
      (searchQuery === '' || 
        m.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

  const stats = {
    total: mockMembers.length,
    online: mockMembers.filter(m => m.status === 'online').length,
    idle: mockMembers.filter(m => m.status === 'idle').length,
    dnd: mockMembers.filter(m => m.status === 'dnd').length,
    offline: mockMembers.filter(m => m.status === 'offline').length,
    bots: mockMembers.filter(m => m.isBot).length,
    warned: mockMembers.filter(m => m.warnings > 0).length,
  };

  const handleKick = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleBan = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleWarn = (memberId: string) => {
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, warnings: m.warnings + 1 } : m
    ));
  };

  const handleAddRole = (memberId: string, role: string) => {
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, roles: [...m.roles, role] } : m
    ));
  };

  const handleRemoveRole = (memberId: string, role: string) => {
    setMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, roles: m.roles.filter(r => r !== role) } : m
    ));
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      online: { label: 'نشط', color: 'text-green-400', badge: 'bg-green-500', dot: 'bg-green-500' },
      idle: { label: 'خامل', color: 'text-yellow-400', badge: 'bg-yellow-500', dot: 'bg-yellow-500' },
      dnd: { label: 'مشغول', color: 'text-red-400', badge: 'bg-red-500', dot: 'bg-red-500' },
      offline: { label: 'غير متصل', color: 'text-gray-400', badge: 'bg-gray-500', dot: 'bg-gray-500' },
    };
    return configs[status as keyof typeof configs] || configs.offline;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'Owner': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      'Admin': 'text-red-400 bg-red-500/20 border-red-500/30',
      'Moderator': 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      'VIP': 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      'Booster': 'text-pink-400 bg-pink-500/20 border-pink-500/30',
      'Member': 'text-gray-400 bg-gray-500/20 border-gray-500/30',
      'Bot': 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
    };
    return colors[role] || 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            إدارة الأعضاء
          </h1>
          <p className="text-gray-400 mt-1">إدارة أعضاء السيرفر، الأدوار، التحذيرات، والحظر</p>
        </div>
        <div className="flex gap-3">
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            دعوة عضو
          </Button>
          <Button variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            تصدير القائمة
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
        {[
          { name: 'إجمالي', value: stats.total, icon: Users, color: 'text-gray-400', bg: 'bg-gray-500/20' },
          { name: 'أونلاين', value: stats.online, icon: Circle, color: 'text-green-400', bg: 'bg-green-500/20' },
          { name: 'خامل', value: stats.idle, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
          { name: 'مشغول', value: stats.dnd, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
          { name: 'أوفلاين', value: stats.offline, icon: User, color: 'text-gray-400', bg: 'bg-gray-500/20' },
          { name: 'بوتات', value: stats.bots, icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
          { name: 'محذرين', value: stats.warned, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/20' },
        ].map(stat => (
          <div key={stat.name} className="card-hover">
            <div className="flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          ))}
      </div>

      {/* Filters */}
      <Card className="card-hover">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="البحث في الأعضاء..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: 'all', label: 'كل الحالات' },
                { value: 'online', label: 'أونلاين' },
                { value: 'idle', label: 'خامل' },
                { value: 'dnd', label: 'مشغول' },
                { value: 'offline', label: 'أوفلاين' },
              ]}
              className="w-40"
            />
            <Select
              value={roleFilter}
              onChange={(val) => setRoleFilter(val)}
              options={[
                { value: 'all', label: 'كل الرولات' },
                { value: 'owner', label: 'Owner' },
                { value: 'admin', label: 'Admin' },
                { value: 'moderator', label: 'Moderator' },
                { value: 'vip', label: 'VIP' },
                { value: 'member', label: 'Member' },
                { value: 'bot', label: 'Bot' },
              ]}
              className="w-40"
            />
            <Select
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                { value: 'joinedAt', label: 'تاريخ الانضمام' },
                { value: 'username', label: 'الاسم' },
                { value: 'warnings', label: 'التحذيرات' },
              ]}
              className="w-40"
            />
            <Select
              value={sortOrder}
              onChange={(val) => setSortOrder(val)}
              options={[
                { value: 'desc', label: 'الأحدث أولاً' },
                { value: 'asc', label: 'الأقدم أولاً' },
              ]}
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card className="card-hover">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العضو</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الأدوار</TableHead>
                  <TableHead>التحذيرات</TableHead>
                  <TableHead>تاريخ الانضمام</TableHead>
                  <TableHead>آخر نشاط</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map(member => {
                  const statusConfig = getStatusConfig(member.status);
                  const isBot = member.isBot;
                  
                  return (
                    <TableRow key={member.id} className="hover:bg-liberty-darker/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar 
                            name={member.displayName} 
                            src={member.avatar} 
                            size="sm" 
                            status={isBot ? undefined : member.status}
                          />
                          <div>
                            <p className="font-medium text-white">{member.displayName}</p>
                            <p className="text-sm text-gray-400 font-mono">{member.username}</p>
                            {member.isBot && <Badge variant="info" className="text-xs ml-2">بوت</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', statusConfig.badge)} />
                          <span className="text-sm" style={{ color: statusConfig.color }}>{statusConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.roles.map(role => (
                            <Badge 
                              key={role} 
                              variant="outline" 
                              className={cn('text-xs', getRoleColor(role))}
                            >
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.warnings > 0 ? (
                          <Badge variant={member.warnings >= 3 ? 'danger' : member.warnings >= 2 ? 'warning' : 'info'}>
                            {member.warnings} تحذير
                          </Badge>
                        ) : (
                          <Badge variant="success">نظيف</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {new Date(member.joinedAt).toLocaleDateString('ar-SA', { 
                          year: 'numeric', month: 'short', day: 'numeric' 
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {member.status === 'online' ? 'الآن' : 'غير معروف'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          }
                          content={
                            <>
                              {!member.isBot && (
                                <>
                                  <DropdownItem 
                                    icon={<Eye className="w-4 h-4" />}
                                    onClick={() => setViewingMember(member)}
                                  >
                                    عرض الملف
                                  </DropdownItem>
                                  <DropdownItem 
                                    icon={<ShieldCheck className="w-4 h-4" />}
                                    onClick={() => setEditingMember({...member, action: 'warn'})}
                                  >
                                    تحذير
                                  </DropdownItem>
                                  <DropdownItem 
                                    icon={<UserPlus className="w-4 h-4" />}
                                    onClick={() => setEditingMember({...member, action: 'addRole'})}
                                  >
                                    إضافة رول
                                  </DropdownItem>
                                  <DropdownItem 
                                    icon={<UserMinus className="w-4 h-4" />}
                                    onClick={() => setEditingMember({...member, action: 'removeRole'})}
                                  >
                                    إزالة رول
                                  </DropdownItem>
                                  <DropdownDivider />
                                  <DropdownItem 
                                    icon={<Ban className="w-4 h-4" />}
                                    danger
                                    onClick={() => handleBan(member.id)}
                                  >
                                    حظر
                                  </DropdownItem>
                                  <DropdownItem 
                                    icon={<Trash2 className="w-4 h-4" />}
                                    danger
                                    onClick={() => handleKick(member.id)}
                                  >
                                    طرد
                                  </DropdownItem>
                                </>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            عرض {filteredMembers.length} من {mockMembers.length} عضو
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>السابق</Button>
            <Button variant="outline" size="sm" disabled>التالي</Button>
          </div>
        </div>
      </div>
    );
  );
}

export default MembersPage;