import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Package, 
  Users, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Palette,
  Scissors,
  Sparkles,
  User,
  Calendar,
  ChevronRight,
  Eye,
  Send,
  FileText,
  TrendingUp,
  Search,
  Filter,
  Plus
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import { formatDate } from '../../../utils/dateFormat';

interface StudioSale {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  fabricType: string;
  quantity: number;
  totalAmount: number;
  saleDate: Date;
  deliveryDeadline: Date;
  status: 'pending' | 'in_progress' | 'completed';
  departments: Department[];
  currentDepartment?: string;
  createdAt: Date;
}

interface Department {
  id: string;
  type: 'dyer' | 'stitcher' | 'handcraft';
  workerId?: string;
  workerName?: string;
  assignedDate?: Date;
  deadline?: Date;
  paymentAmount?: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  notes?: string;
  completedDate?: Date;
}

interface Worker {
  id: string;
  name: string;
  phone: string;
  department: 'dyer' | 'stitcher' | 'handcraft';
  totalEarnings: number;
  pendingPayment: number;
  completedTasks: number;
  activeTasks: number;
  rating: number;
  joinedDate: Date;
}

interface Payment {
  id: string;
  workerId: string;
  workerName: string;
  saleId: string;
  invoiceNumber: string;
  amount: number;
  status: 'pending' | 'paid';
  dueDate: Date;
  paidDate?: Date;
  department: string;
}

type ViewMode = 'dashboard' | 'sales' | 'workers' | 'payments' | 'reports';

export const StudioWorkflowPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedSale, setSelectedSale] = useState<StudioSale | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Mock data - Replace with actual data from localStorage/API
  const [studioSales, setStudioSales] = useState<StudioSale[]>([
    {
      id: 'SS001',
      invoiceNumber: 'INV-2026-0015',
      customerName: 'Ayesha Khan',
      customerPhone: '+92 300 1234567',
      fabricType: 'Silk Lawn - Red (5 meters)',
      quantity: 5,
      totalAmount: 15000,
      saleDate: new Date('2026-01-03'),
      deliveryDeadline: new Date('2026-01-20'),
      status: 'in_progress',
      currentDepartment: 'Dyeing',
      departments: [
        {
          id: 'D1',
          type: 'dyer',
          workerId: 'W001',
          workerName: 'Ahmed Ali',
          assignedDate: new Date('2026-01-03'),
          deadline: new Date('2026-01-10'),
          paymentAmount: 2000,
          status: 'in_progress',
          notes: 'Deep red color required'
        },
        {
          id: 'D2',
          type: 'stitcher',
          status: 'pending'
        }
      ],
      createdAt: new Date('2026-01-03')
    },
    {
      id: 'SS002',
      invoiceNumber: 'INV-2026-0018',
      customerName: 'Fatima Ahmed',
      customerPhone: '+92 301 9876543',
      fabricType: 'Cotton Lawn - Blue (8 meters)',
      quantity: 8,
      totalAmount: 22000,
      saleDate: new Date('2026-01-04'),
      deliveryDeadline: new Date('2026-01-25'),
      status: 'pending',
      departments: [
        {
          id: 'D3',
          type: 'dyer',
          status: 'pending'
        },
        {
          id: 'D4',
          type: 'handcraft',
          status: 'pending'
        }
      ],
      createdAt: new Date('2026-01-04')
    }
  ]);

  const [workers, setWorkers] = useState<Worker[]>([
    {
      id: 'W001',
      name: 'Ahmed Ali',
      phone: '+92 300 1111111',
      department: 'dyer',
      totalEarnings: 45000,
      pendingPayment: 2000,
      completedTasks: 23,
      activeTasks: 1,
      rating: 4.5,
      joinedDate: new Date('2025-06-15')
    },
    {
      id: 'W002',
      name: 'Hassan Raza',
      phone: '+92 300 2222222',
      department: 'stitcher',
      totalEarnings: 67000,
      pendingPayment: 0,
      completedTasks: 34,
      activeTasks: 0,
      rating: 4.8,
      joinedDate: new Date('2025-03-20')
    },
    {
      id: 'W003',
      name: 'Sana Malik',
      phone: '+92 300 3333333',
      department: 'handcraft',
      totalEarnings: 52000,
      pendingPayment: 3500,
      completedTasks: 28,
      activeTasks: 2,
      rating: 4.7,
      joinedDate: new Date('2025-08-10')
    }
  ]);

  const [payments, setPayments] = useState<Payment[]>([
    {
      id: 'P001',
      workerId: 'W001',
      workerName: 'Ahmed Ali',
      saleId: 'SS001',
      invoiceNumber: 'INV-2026-0015',
      amount: 2000,
      status: 'pending',
      dueDate: new Date('2026-01-10'),
      department: 'Dyeing'
    },
    {
      id: 'P002',
      workerId: 'W003',
      workerName: 'Sana Malik',
      saleId: 'SS002',
      invoiceNumber: 'INV-2026-0018',
      amount: 3500,
      status: 'pending',
      dueDate: new Date('2026-01-15'),
      department: 'Handcraft'
    }
  ]);

  const getDepartmentIcon = (type: Department['type']) => {
    switch (type) {
      case 'dyer': return <Palette className="text-purple-400" size={18} />;
      case 'stitcher': return <Scissors className="text-blue-400" size={18} />;
      case 'handcraft': return <Sparkles className="text-pink-400" size={18} />;
    }
  };

  const getDepartmentName = (type: Department['type']) => {
    switch (type) {
      case 'dyer': return 'Dyeing';
      case 'stitcher': return 'Stitching';
      case 'handcraft': return 'Handcraft';
    }
  };

  const getStatusColor = (status: Department['status']) => {
    switch (status) {
      case 'pending': return {
        backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-secondary)',
        borderColor: 'var(--color-border-secondary)'
      };
      case 'assigned': return {
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        color: 'rgba(234, 179, 8, 1)',
        borderColor: 'rgba(234, 179, 8, 0.3)'
      };
      case 'in_progress': return {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--color-primary)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      };
      case 'completed': return {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: 'rgba(16, 185, 129, 1)',
        borderColor: 'rgba(16, 185, 129, 0.3)'
      };
    }
  };

  const handleAssignWorker = (sale: StudioSale, department: Department) => {
    setSelectedSale(sale);
    setSelectedDepartment(department);
    setShowAssignModal(true);
  };

  const handleUpdateStatus = (saleId: string, departmentId: string, newStatus: Department['status']) => {
    setStudioSales(prev => prev.map(sale => {
      if (sale.id === saleId) {
        return {
          ...sale,
          departments: sale.departments.map(dept => {
            if (dept.id === departmentId) {
              return {
                ...dept,
                status: newStatus,
                completedDate: newStatus === 'completed' ? new Date() : dept.completedDate
              };
            }
            return dept;
          }),
          status: sale.departments.every(d => d.id === departmentId ? newStatus === 'completed' : d.status === 'completed')
            ? 'completed'
            : 'in_progress'
        };
      }
      return sale;
    }));
  };

  const handleMarkPaid = (paymentId: string) => {
    setPayments(prev => prev.map(payment => {
      if (payment.id === paymentId) {
        return {
          ...payment,
          status: 'paid',
          paidDate: new Date()
        };
      }
      return payment;
    }));

    // Update worker pending payment
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      setWorkers(prev => prev.map(worker => {
        if (worker.id === payment.workerId) {
          return {
            ...worker,
            pendingPayment: worker.pendingPayment - payment.amount,
            totalEarnings: worker.totalEarnings + payment.amount
          };
        }
        return worker;
      }));
    }
  };

  // Statistics
  const stats = {
    totalOrders: studioSales.length,
    inProgress: studioSales.filter(s => s.status === 'in_progress').length,
    completed: studioSales.filter(s => s.status === 'completed').length,
    pendingPayments: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
    activeWorkers: workers.filter(w => w.activeTasks > 0).length,
    totalWorkers: workers.length
  };

  const filteredSales = studioSales.filter(sale => {
    const matchesSearch = sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.fabricType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Package 
              size={24}
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <h1 
              className="text-3xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Studio Workflow
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Integrated fabric processing & worker management
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div 
        className="flex gap-2 mb-6 p-1 rounded-xl border w-fit"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <button
          onClick={() => setViewMode('dashboard')}
          className="px-6 py-3 rounded-lg font-medium transition-all"
          style={viewMode === 'dashboard' ? {
            backgroundColor: 'var(--color-wholesale)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px rgba(147, 51, 234, 0.3)',
            borderRadius: 'var(--radius-lg)'
          } : {
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            if (viewMode !== 'dashboard') {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (viewMode !== 'dashboard') {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={18} />
            Dashboard
          </div>
        </button>
        <button
          onClick={() => setViewMode('sales')}
          className="px-6 py-3 rounded-lg font-medium transition-all"
          style={viewMode === 'sales' ? {
            backgroundColor: 'var(--color-wholesale)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px rgba(147, 51, 234, 0.3)',
            borderRadius: 'var(--radius-lg)'
          } : {
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            if (viewMode !== 'sales') {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (viewMode !== 'sales') {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Package size={18} />
            Studio Sales
          </div>
        </button>
        <button
          onClick={() => setViewMode('workers')}
          className="px-6 py-3 rounded-lg font-medium transition-all"
          style={viewMode === 'workers' ? {
            backgroundColor: 'var(--color-wholesale)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px rgba(147, 51, 234, 0.3)',
            borderRadius: 'var(--radius-lg)'
          } : {
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            if (viewMode !== 'workers') {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (viewMode !== 'workers') {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Users size={18} />
            Workers
          </div>
        </button>
        <button
          onClick={() => setViewMode('payments')}
          className="px-6 py-3 rounded-lg font-medium transition-all"
          style={viewMode === 'payments' ? {
            backgroundColor: 'var(--color-wholesale)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px rgba(147, 51, 234, 0.3)',
            borderRadius: 'var(--radius-lg)'
          } : {
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            if (viewMode !== 'payments') {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (viewMode !== 'payments') {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <DollarSign size={18} />
            Payments
          </div>
        </button>
        <button
          onClick={() => setViewMode('reports')}
          className="px-6 py-3 rounded-lg font-medium transition-all"
          style={viewMode === 'reports' ? {
            backgroundColor: 'var(--color-wholesale)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px rgba(147, 51, 234, 0.3)',
            borderRadius: 'var(--radius-lg)'
          } : {
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            if (viewMode !== 'reports') {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (viewMode !== 'reports') {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <FileText size={18} />
            Reports
          </div>
        </button>
      </div>

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-6 gap-4">
            <div 
              className="border rounded-xl p-5"
              style={{
                background: 'linear-gradient(to bottom right, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0.1))',
                borderColor: 'rgba(147, 51, 234, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <Package 
                  size={24}
                  style={{ color: 'var(--color-wholesale)' }}
                />
                <Badge 
                  style={{
                    backgroundColor: 'rgba(147, 51, 234, 0.2)',
                    color: 'var(--color-wholesale)',
                    borderColor: 'rgba(147, 51, 234, 0.3)'
                  }}
                >
                  Total
                </Badge>
              </div>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {stats.totalOrders}
              </div>
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Orders
              </div>
            </div>

            <div 
              className="border rounded-xl p-5"
              style={{
                background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <Clock 
                  size={24}
                  style={{ color: 'var(--color-primary)' }}
                />
                <Badge 
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: 'var(--color-primary)',
                    borderColor: 'rgba(59, 130, 246, 0.3)'
                  }}
                >
                  Active
                </Badge>
              </div>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {stats.inProgress}
              </div>
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                In Progress
              </div>
            </div>

            <div 
              className="border rounded-xl p-5"
              style={{
                background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 
                  size={24}
                  style={{ color: 'rgba(16, 185, 129, 1)' }}
                />
                <Badge 
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: 'rgba(16, 185, 129, 1)',
                    borderColor: 'rgba(16, 185, 129, 0.3)'
                  }}
                >
                  Done
                </Badge>
              </div>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {stats.completed}
              </div>
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Completed
              </div>
            </div>

            <div 
              className="border rounded-xl p-5"
              style={{
                background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.2), rgba(234, 179, 8, 0.1))',
                borderColor: 'rgba(234, 179, 8, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign 
                  size={24}
                  style={{ color: 'rgba(234, 179, 8, 1)' }}
                />
                <Badge 
                  style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.2)',
                    color: 'rgba(234, 179, 8, 1)',
                    borderColor: 'rgba(234, 179, 8, 0.3)'
                  }}
                >
                  Pending
                </Badge>
              </div>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                ₨{stats.pendingPayments.toLocaleString()}
              </div>
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Pending Payments
              </div>
            </div>

            <div 
              className="border rounded-xl p-5"
              style={{
                background: 'linear-gradient(to bottom right, rgba(236, 72, 153, 0.2), rgba(236, 72, 153, 0.1))',
                borderColor: 'rgba(236, 72, 153, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <Users 
                  size={24}
                  style={{ color: 'rgba(236, 72, 153, 1)' }}
                />
                <Badge 
                  style={{
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    color: 'rgba(236, 72, 153, 1)',
                    borderColor: 'rgba(236, 72, 153, 0.3)'
                  }}
                >
                  Active
                </Badge>
              </div>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {stats.activeWorkers}
              </div>
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Active Workers
              </div>
            </div>

            <div 
              className="border rounded-xl p-5"
              style={{
                background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.1))',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <User 
                  size={24}
                  style={{ color: 'rgba(99, 102, 241, 1)' }}
                />
                <Badge 
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: 'rgba(99, 102, 241, 1)',
                    borderColor: 'rgba(99, 102, 241, 0.3)'
                  }}
                >
                  Total
                </Badge>
              </div>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {stats.totalWorkers}
              </div>
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Workers
              </div>
            </div>
          </div>

          {/* Recent Studio Sales */}
          <div 
            className="border rounded-xl p-6"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 
                className="text-xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Recent Studio Sales
              </h2>
              <Button 
                onClick={() => setViewMode('sales')}
                style={{
                  backgroundColor: 'var(--color-wholesale)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                }}
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {studioSales.slice(0, 5).map(sale => (
                <div 
                  key={sale.id} 
                  className="border rounded-lg p-4 transition-colors"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span 
                          className="font-semibold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {sale.customerName}
                        </span>
                        <Badge 
                          className="text-xs"
                          style={{
                            backgroundColor: 'var(--color-bg-card)',
                            color: 'var(--color-text-secondary)',
                            borderColor: 'var(--color-border-secondary)'
                          }}
                        >
                          {sale.invoiceNumber}
                        </Badge>
                        <Badge style={getStatusColor(sale.status as any)}>
                          {sale.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div 
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {sale.fabricType}
                      </div>
                      <div 
                        className="flex items-center gap-4 mt-2 text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        <span>₨{sale.totalAmount.toLocaleString()}</span>
                        <span>•</span>
                        <span>Due: {formatDate(sale.deliveryDeadline)}</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => {
                        setSelectedSale(sale);
                        setViewMode('sales');
                      }}
                      variant="outline"
                      style={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border-secondary)',
                        color: 'var(--color-text-primary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                      }}
                    >
                      <Eye size={16} className="mr-2" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Studio Sales View */}
      {viewMode === 'sales' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2" 
                size={20}
                style={{ color: 'var(--color-text-tertiary)' }}
              />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer, invoice, or fabric type..."
                className="pl-10"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Sales List */}
          <div className="space-y-4">
            {filteredSales.map(sale => (
              <div 
                key={sale.id} 
                className="border rounded-xl p-6"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                {/* Sale Header */}
                <div 
                  className="flex items-start justify-between mb-4 pb-4 border-b"
                  style={{ borderBottomColor: 'var(--color-border-primary)' }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 
                        className="text-xl font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {sale.customerName}
                      </h3>
                      <Badge 
                        style={{
                          backgroundColor: 'rgba(147, 51, 234, 0.2)',
                          color: 'var(--color-wholesale)',
                          borderColor: 'rgba(147, 51, 234, 0.3)'
                        }}
                      >
                        {sale.invoiceNumber}
                      </Badge>
                      <Badge style={getStatusColor(sale.status as any)}>
                        {sale.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <User size={16} />
                        <span>{sale.customerPhone}</span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <Calendar size={16} />
                        <span>Sale Date: {formatDate(sale.saleDate)}</span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <Package size={16} />
                        <span>{sale.fabricType}</span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <Clock size={16} />
                        <span style={{ color: 'rgba(234, 179, 8, 1)' }}>
                          Deadline: {formatDate(sale.deliveryDeadline)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div 
                      className="text-2xl font-bold mb-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ₨{sale.totalAmount.toLocaleString()}
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {sale.quantity} meters
                    </div>
                  </div>
                </div>

                {/* Departments */}
                <div className="space-y-3">
                  <h4 
                    className="font-semibold mb-3"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Department Pipeline
                  </h4>
                  {sale.departments.map((dept, index) => (
                    <div 
                      key={dept.id} 
                      className="border rounded-lg p-4 transition-all"
                      style={
                        dept.status === 'in_progress' 
                          ? {
                              backgroundColor: 'var(--color-bg-card)',
                              borderColor: 'var(--color-primary)',
                              boxShadow: '0 10px 15px rgba(59, 130, 246, 0.2)',
                              borderRadius: 'var(--radius-lg)'
                            }
                          : dept.status === 'completed'
                          ? {
                              backgroundColor: 'var(--color-bg-card)',
                              borderColor: 'rgba(16, 185, 129, 1)',
                              boxShadow: '0 10px 15px rgba(16, 185, 129, 0.2)',
                              borderRadius: 'var(--radius-lg)'
                            }
                          : {
                              backgroundColor: 'var(--color-bg-card)',
                              borderColor: 'var(--color-border-secondary)',
                              borderRadius: 'var(--radius-lg)'
                            }
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              borderRadius: 'var(--radius-lg)'
                            }}
                          >
                            {getDepartmentIcon(dept.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span 
                                className="font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {getDepartmentName(dept.type)}
                              </span>
                              <Badge style={getStatusColor(dept.status)}>
                                {dept.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            {dept.workerName && (
                              <div 
                                className="text-sm"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                Worker: {dept.workerName} • Payment: ₨{dept.paymentAmount?.toLocaleString()}
                              </div>
                            )}
                            {dept.deadline && (
                              <div 
                                className="text-xs mt-1"
                                style={{ color: 'var(--color-text-tertiary)' }}
                              >
                                Deadline: {formatDate(dept.deadline)}
                              </div>
                            )}
                            {dept.notes && (
                              <div 
                                className="text-xs mt-1"
                                style={{ color: 'var(--color-primary)' }}
                              >
                                Note: {dept.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {dept.status === 'pending' && (
                            <Button 
                              onClick={() => handleAssignWorker(sale, dept)}
                              style={{
                                backgroundColor: 'var(--color-wholesale)',
                                color: 'var(--color-text-primary)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-700
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                              }}
                            >
                              <Send size={16} className="mr-2" />
                              Assign Worker
                            </Button>
                          )}
                          {dept.status === 'assigned' && (
                            <Button 
                              onClick={() => handleUpdateStatus(sale.id, dept.id, 'in_progress')}
                              style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text-primary)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)'; // blue-700
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                              }}
                            >
                              Start Work
                            </Button>
                          )}
                          {dept.status === 'in_progress' && (
                            <Button 
                              onClick={() => handleUpdateStatus(sale.id, dept.id, 'completed')}
                              style={{
                                backgroundColor: 'rgba(16, 185, 129, 1)',
                                color: 'var(--color-text-primary)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 1)'; // emerald-700
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 1)';
                              }}
                            >
                              <CheckCircle2 size={16} className="mr-2" />
                              Mark Complete
                            </Button>
                          )}
                          {dept.status === 'completed' && (
                            <div 
                              className="flex items-center gap-2"
                              style={{ color: 'rgba(16, 185, 129, 1)' }}
                            >
                              <CheckCircle2 size={20} />
                              <span className="text-sm font-medium">Completed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workers View */}
      {viewMode === 'workers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Worker Management
            </h2>
            <Button 
              style={{
                backgroundColor: 'var(--color-wholesale)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-700
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
              }}
            >
              <Plus size={18} className="mr-2" />
              Add New Worker
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {workers.map(worker => (
              <div 
                key={worker.id} 
                className="border rounded-xl p-6"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{
                      background: 'linear-gradient(to bottom right, var(--color-wholesale), rgba(236, 72, 153, 1))',
                      color: 'var(--color-text-primary)',
                      borderRadius: '50%'
                    }}
                  >
                    {worker.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 
                      className="font-bold text-lg"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {worker.name}
                    </h3>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {getDepartmentName(worker.department)}
                    </div>
                    <div 
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {worker.phone}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Total Earnings
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ₨{worker.totalEarnings.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Pending Payment
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ 
                        color: worker.pendingPayment > 0 ? 'rgba(234, 179, 8, 1)' : 'rgba(16, 185, 129, 1)' 
                      }}
                    >
                      ₨{worker.pendingPayment.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Completed Tasks
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {worker.completedTasks}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Active Tasks
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ 
                        color: worker.activeTasks > 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)' 
                      }}
                    >
                      {worker.activeTasks}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Rating
                    </span>
                    <span 
                      className="font-semibold"
                      style={{ color: 'rgba(234, 179, 8, 1)' }}
                    >
                      ⭐ {worker.rating}/5
                    </span>
                  </div>
                </div>

                <Button 
                  className="w-full mt-4"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    color: 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                  }}
                >
                  View Details
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments View */}
      {viewMode === 'payments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Payment Management
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Total Pending
                </div>
                <div 
                  className="text-2xl font-bold"
                  style={{ color: 'rgba(234, 179, 8, 1)' }}
                >
                  ₨{payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div 
            className="border rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <table className="w-full">
              <thead 
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderBottomColor: 'var(--color-border-secondary)'
                }}
              >
                <tr>
                  <th 
                    className="text-left p-4 font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Worker
                  </th>
                  <th 
                    className="text-left p-4 font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Department
                  </th>
                  <th 
                    className="text-left p-4 font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Invoice
                  </th>
                  <th 
                    className="text-right p-4 font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Amount
                  </th>
                  <th 
                    className="text-center p-4 font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Due Date
                  </th>
                  <th 
                    className="text-center p-4 font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Status
                  </th>
                  <th 
                    className="text-right p-4 font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => (
                  <tr 
                    key={payment.id} 
                    className="border-b transition-colors"
                    style={{ borderBottomColor: 'var(--color-border-primary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td className="p-4">
                      <div 
                        className="font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {payment.workerName}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge 
                        style={{
                          backgroundColor: 'rgba(147, 51, 234, 0.2)',
                          color: 'var(--color-wholesale)',
                          borderColor: 'rgba(147, 51, 234, 0.3)'
                        }}
                      >
                        {payment.department}
                      </Badge>
                    </td>
                    <td 
                      className="p-4"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {payment.invoiceNumber}
                    </td>
                    <td className="p-4 text-right">
                      <span 
                        className="font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        ₨{payment.amount.toLocaleString()}
                      </span>
                    </td>
                    <td 
                      className="p-4 text-center"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {formatDate(payment.dueDate)}
                    </td>
                    <td className="p-4 text-center">
                      <Badge 
                        style={
                          payment.status === 'paid'
                            ? {
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: 'rgba(16, 185, 129, 1)',
                                borderColor: 'rgba(16, 185, 129, 0.3)'
                              }
                            : {
                                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                                color: 'rgba(234, 179, 8, 1)',
                                borderColor: 'rgba(234, 179, 8, 0.3)'
                              }
                        }
                      >
                        {payment.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      {payment.status === 'pending' ? (
                        <Button 
                          onClick={() => handleMarkPaid(payment.id)}
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 1)',
                            color: 'var(--color-text-primary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 1)'; // emerald-700
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 1)';
                          }}
                        >
                          Mark Paid
                        </Button>
                      ) : (
                        <span 
                          className="text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Paid on {payment.paidDate ? formatDate(payment.paidDate) : 'N/A'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports View */}
      {viewMode === 'reports' && (
        <div className="space-y-6">
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Studio Reports
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div 
              className="border rounded-xl p-6 transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              <FileText 
                className="mb-4" 
                size={32}
                style={{ color: 'var(--color-wholesale)' }}
              />
              <h3 
                className="text-lg font-bold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Customer Invoices
              </h3>
              <p 
                className="text-sm mb-4"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Generate detailed customer invoices with fabric traceability
              </p>
              <Button 
                className="w-full"
                style={{
                  backgroundColor: 'var(--color-wholesale)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                }}
              >
                Generate Report
              </Button>
            </div>

            <div 
              className="border rounded-xl p-6 transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              <DollarSign 
                className="mb-4" 
                size={32}
                style={{ color: 'var(--color-primary)' }}
              />
              <h3 
                className="text-lg font-bold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Worker Payments
              </h3>
              <p 
                className="text-sm mb-4"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                View all worker payments and pending dues
              </p>
              <Button 
                className="w-full"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)'; // blue-700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                }}
              >
                Generate Report
              </Button>
            </div>

            <div 
              className="border rounded-xl p-6 transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              <Package 
                className="mb-4" 
                size={32}
                style={{ color: 'rgba(16, 185, 129, 1)' }}
              />
              <h3 
                className="text-lg font-bold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Fabric Traceability
              </h3>
              <p 
                className="text-sm mb-4"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Track fabric journey through all departments
              </p>
              <Button 
                className="w-full"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 1)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 1)'; // emerald-700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 1)';
                }}
              >
                Generate Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {showAssignModal && selectedSale && selectedDepartment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div 
            className="border rounded-xl p-6 max-w-2xl w-full"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <h3 
              className="text-xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Assign Worker - {getDepartmentName(selectedDepartment.type)}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Select Worker
                </Label>
                <select 
                  className="w-full px-4 py-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <option value="">Choose a worker...</option>
                  {workers
                    .filter(w => w.department === selectedDepartment.type)
                    .map(worker => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name} - {worker.activeTasks} active tasks
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Deadline
                </Label>
                <CalendarDatePicker
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Payment Amount (₨)
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Notes / Instructions
                </Label>
                <Textarea
                  placeholder="Add any specific instructions for the worker..."
                  rows={3}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => setShowAssignModal(false)}
                variant="outline"
                className="flex-1"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  handleUpdateStatus(selectedSale.id, selectedDepartment.id, 'assigned');
                  setShowAssignModal(false);
                }}
                className="flex-1"
                style={{
                  backgroundColor: 'var(--color-wholesale)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                }}
              >
                Assign Worker
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};