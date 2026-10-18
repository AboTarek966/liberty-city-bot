'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, Search, Filter, MoreVertical,
  Trash2, Edit, Eye, Clock, AlertTriangle, CheckCircle,
  XCircle, User, Hash, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

const ticketTypes = [
  { value: 'technical', label: '🔧 دعم فني', color: 'text-blue-400' },
  { value: 'billing', label: '💰 فواتير', color: 'text-green-400' },
  { type: 'complaint', label: '⚠️ شكوى', color: 'text-red-400' },
  { value: 'inquiry', label: '❓ استفسار', color: 'text-yellow-400' },
  { value: 'protection', label: '🛡️ حماية', color: 'text-purple-400' },
  { value: 'other', label: '📦 أخرى', color: 'text-gray-400' },
];

const statuses = [
  { value: 'open', label: 'مفتوحة', color: 'text-blue-400', badge: 'badge-info' },
  { value: 'claimed', label: 'مستلمة', color: 'text-purple-400', badge: 'badge-warning' },
  { value: 'waiting', label: 'بانتظار الرد', color: 'text-yellow-400', badge: 'badge-warning' },
  { value: 'closed', label: 'مغلقة', color: 'text-green-400', badge: 'badge-success' },
];

const mockTickets = [
  { id: '1', number: '#001', type: 'technical', subject: 'البوت لا يرد على الأوامر', user: 'Ahmed#1234', status: 'open', priority: 'high', createdAt: '2024-01-15T10:30:00Z', claimedBy: null },
  { id: '2', number: '#002', type: 'billing', subject: 'مشكلة في الشراء', user: 'Mohamed#5678', status: 'claimed', priority: 'medium', createdAt: '2024-01-15T09:15:00Z', claimedBy: 'Admin#001' },
  { id: '3', number: '#003', type: 'complaint', subject: 'إساءة استخدام من عضو', user: 'User#9999', status: 'waiting', priority: 'high', createdAt: '2024-01-14T16:45:00Z', claimedBy: 'Mod#002' },
  { id: '4', number: '#004', type: 'inquiry', subject: 'كيف أفتح تذكرة؟', user: 'NewUser#1111', status: 'open', priority: 'low', createdAt: '2024-01-14T14:20:00Z', claimedBy: null },
  { id: '5', number: '#005', type: 'protection', subject: 'تم حظري بالخطأ', user: 'Player#2222', status: 'claimed', priority: 'high', createdAt: '2024-01-13T11:00:00Z', claimedBy: 'Admin#001' },
  { id: '6', number: '#006', type: 'technical', subject: 'أوامر الحماية لا تعمل', user: 'Admin#003', status: 'closed', priority: 'medium', createdAt: '2024-01-12T08:30:00Z', claimedBy: 'Admin#002' },
];

export default function TicketsPage() {
  const [tickets, setTickets] = useState(mockTickets);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [viewingTicket, setViewingTicket] = useState<any>(null);

  const filteredTickets = tickets
    .filter(t => 
      (statusFilter === 'all' || t.status === statusFilter) &&
      (typeFilter === 'all' || t.type === typeFilter) &&
      (searchQuery === '' || 
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.number.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    claimed: tickets.filter(t => t.status === 'claimed').length,
    waiting: tickets.filter(t => t.status === 'waiting').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, status: newStatus } : t
    ));
  };

  const handlePriorityChange = (ticketId: string, newPriority: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, priority: newPriority } : t
    ));
  };

  const handleClaim = (ticketId: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, status: 'claimed', claimedBy: 'CurrentAdmin#001' } : t
    ));
  };

  const handleClose = (ticketId: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, status: 'closed' } : t
    ));
  };

  const handleDelete = (ticketId: string) => {
    setTickets(prev => prev.filter(t => t.id !== ticketId));
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">نظام التذاكر</h1>
            <p className="text-gray-400 mt-1">إدارة تذاكر الدعم والدعم الفني</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      open: { label: 'مفتوحة', color: 'text-blue-400', badge: 'badge-info' },
      claimed: { label: 'مستلمة', color: 'text-purple-400', badge: 'badge-warning' },
      waiting: { label: 'بانتظار الرد', color: 'text-yellow-400', badge: 'badge-warning' },
      closed: { label: 'مغلقة', color: 'text-green-400', badge: 'badge-success' },
    };
    return configs[status as keyof typeof configs] || { label: status, color: 'text-gray-400', badge: 'badge-outline' };
  };

  const getTypeConfig = (type: string) => {
    const configs = {
      technical: { label: 'دعم فني', color: 'text-blue-400' },
      billing: { label: 'فواتير', color: 'text-green-400' },
      complaint: { label: 'شكوى', color: 'text-red-400' },
      inquiry: { label: 'استفسار', color: 'text-yellow-400' },
      protection: { label: 'حماية', color: 'text-purple-400' },
      other: { label: 'أخرى', color: 'text-gray-400' },
    };
    return configs[type as keyof typeof configs] || { label: type, color: 'text-gray-400' };
  };

  const getPriorityConfig = (priority: string) => {
    const configs = {
      high: { label: 'عالية', color: 'text-red-400', badge: 'badge-danger' },
      medium: { label: 'متوسطة', color: 'text-yellow-400', badge: 'badge-warning' },
      low: { label: 'منخفضة', color: 'text-green-400', badge: 'badge-success' },
    };
    return configs[priority as keyof typeof configs] || { label: priority, color: 'text-gray-400', badge: 'badge-outline' };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-500" />
            نظام التذاكر
          </h1>
          <p className="text-gray-400 mt-1">إدارة تذاكر الدعم الفني والدعم</p>
        </div>
        <div className="flex gap-3">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            تذكرة جديدة
          </Button>
          <Button variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            تصدير
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { name: 'إجمالي', value: stats.total, icon: Hash, color: 'text-gray-400', bg: 'bg-gray-500/20' },
          { name: 'مفتوحة', value: stats.open, icon: AlertTriangle, color: 'text-blue-400', bg: 'bg-blue-500/20' },
          { name: 'مستلمة', value: stats.claimed, icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/20' },
          { name: 'بانتظار', value: stats.waiting, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
          { name: 'مغلقة', value: stats.closed, icon: XCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
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
      </div>

      {/* Filters */}
      <Card className="card-hover">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="البحث في التذاكر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[{ value: 'all', label: 'كل الحالات' }, ...statuses.map(s => ({ value: s.value, label: s.label }))]}
              className="w-40"
            />
            <Select
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={[{ value: 'all', label: 'كل الأنواع' }, ...ticketTypes.map(t => ({ value: t.value, label: t.label }))]}
              className="w-40"
            />
            <Select
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                { value: 'createdAt', label: 'تاريخ الإنشاء' },
                { value: 'priority', label: 'الأولوية' },
                { value: 'number', label: 'الرقم' },
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

      {/* Tickets Table */}
      <Card className="card-hover">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الموضوع</TableHead>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الأولوية</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>المستلم</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map(ticket => {
                  const statusConfig = getStatusConfig(ticket.status);
                  const typeConfig = getTypeConfig(ticket.type);
                  const priorityConfig = getPriorityConfig(ticket.priority);
                  
                  return (
                    <TableRow key={ticket.id} className="hover:bg-liberty-darker/50">
                      <TableCell className="font-mono text-sm text-gray-400">{ticket.number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', typeConfig.color)}>
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-medium text-white">{ticket.subject}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={ticket.user} size="sm" />
                          <span className="text-sm text-white">{ticket.user}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statuses.find(s => s.value === ticket.status)?.badge || 'badge-outline'}>
                          {statuses.find(s => s.value === ticket.status)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityConfig.badge}>{priorityConfig.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {new Date(ticket.createdAt).toLocaleDateString('ar-SA', { 
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </TableCell>
                      <TableCell>
                        {ticket.claimedBy ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={ticket.claimedBy} size="xs" />
                            <span className="text-sm text-white">{ticket.claimedBy}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs">—</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {ticket.status !== 'closed' && (
                            <Button variant="ghost" size="sm" onClick={() => handleClaim(ticket.id)}>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              استلام
                            </Button>
                          )}
                          {ticket.status !== 'closed' && (
                            <Button variant="ghost" size="sm" onClick={() => handleClose(ticket.id)}>
                              <XCircle className="w-4 h-4 mr-1" />
                              إغلاق
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setViewingTicket(ticket)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingTicket(ticket)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" danger onClick={() => handleDelete(ticket.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            عرض {filteredTickets.length} من {tickets.length} تذكرة
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

export default TicketsPage;