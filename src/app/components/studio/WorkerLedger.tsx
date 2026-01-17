import React, { useState } from 'react';
import { X, Users, DollarSign, CheckCircle, Clock, Search, Filter, TrendingUp } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { formatDate } from '../../../utils/dateFormat';

interface WorkerLedgerProps {
  onClose: () => void;
}

interface WorkerTask {
  id: string;
  invoiceNumber: string;
  customerName: string;
  taskType: 'dyeing' | 'tailoring' | 'handcraft';
  description: string;
  amount: number;
  paymentStatus: 'pending' | 'completed';
  assignedDate: string;
  completedDate?: string;
  paidDate?: string;
}

interface Worker {
  id: string;
  name: string;
  department: 'dyeing' | 'tailoring' | 'handcraft';
  phone: string;
  totalTasks: number;
  completedTasks: number;
  pendingPayment: number;
  totalEarned: number;
  tasks: WorkerTask[];
}

const SAMPLE_WORKERS: Worker[] = [
  {
    id: '1',
    name: 'Ali Hassan',
    department: 'dyeing',
    phone: '+92 300 1111111',
    totalTasks: 15,
    completedTasks: 12,
    pendingPayment: 8500,
    totalEarned: 45000,
    tasks: [
      {
        id: 't1',
        invoiceNumber: 'INV-2026-001',
        customerName: 'Ayesha Khan',
        taskType: 'dyeing',
        description: 'Gradient dyeing - Red to Gold',
        amount: 3000,
        paymentStatus: 'pending',
        assignedDate: '2026-01-05',
        completedDate: '2026-01-05'
      },
      {
        id: 't2',
        invoiceNumber: 'INV-2026-003',
        customerName: 'Hina Ahmed',
        taskType: 'dyeing',
        description: 'Solid color dyeing - Purple',
        amount: 2500,
        paymentStatus: 'completed',
        assignedDate: '2026-01-04',
        completedDate: '2026-01-04',
        paidDate: '2026-01-05'
      }
    ]
  },
  {
    id: '2',
    name: 'Fatima Ahmed',
    department: 'tailoring',
    phone: '+92 321 2222222',
    totalTasks: 20,
    completedTasks: 18,
    pendingPayment: 12000,
    totalEarned: 75000,
    tasks: [
      {
        id: 't3',
        invoiceNumber: 'INV-2026-001',
        customerName: 'Ayesha Khan',
        taskType: 'tailoring',
        description: 'Semi-stitched tailoring',
        amount: 5000,
        paymentStatus: 'pending',
        assignedDate: '2026-01-05'
      }
    ]
  },
  {
    id: '3',
    name: 'Ahmad Raza',
    department: 'handcraft',
    phone: '+92 333 3333333',
    totalTasks: 10,
    completedTasks: 8,
    pendingPayment: 15000,
    totalEarned: 60000,
    tasks: []
  },
  {
    id: '4',
    name: 'Maryam Khan',
    department: 'dyeing',
    phone: '+92 345 4444444',
    totalTasks: 12,
    completedTasks: 10,
    pendingPayment: 6000,
    totalEarned: 38000,
    tasks: []
  }
];

export const WorkerLedger: React.FC<WorkerLedgerProps> = ({ onClose }) => {
  const [workers] = useState<Worker[]>(SAMPLE_WORKERS);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          worker.phone.includes(searchTerm);
    const matchesDept = filterDept === 'all' || worker.department === filterDept;
    return matchesSearch && matchesDept;
  });

  const stats = {
    totalWorkers: workers.length,
    totalPending: workers.reduce((sum, w) => sum + w.pendingPayment, 0),
    totalPaid: workers.reduce((sum, w) => sum + w.totalEarned, 0),
    activeTasks: workers.reduce((sum, w) => sum + (w.totalTasks - w.completedTasks), 0)
  };

  const handlePayment = (workerId: string, taskId: string) => {
    alert(`Payment processed for task ${taskId}`);
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Users 
                size={28}
                style={{ color: 'var(--color-wholesale)' }}
              />
              Worker Accounts & Payment Ledger
            </h2>
            <p 
              className="mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Track worker tasks and manage payments
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <X size={16} className="mr-2" />
            Close
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div 
            className="border rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <Users size={20} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <div 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Total Workers
                </div>
                <div 
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {stats.totalWorkers}
                </div>
              </div>
            </div>
          </div>

          <div 
            className="border rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(249, 115, 22, 0.2)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <Clock size={20} style={{ color: 'var(--color-warning)' }} />
              </div>
              <div>
                <div 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Pending Payment
                </div>
                <div 
                  className="text-xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  ₹{stats.totalPending.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div 
            className="border rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
              </div>
              <div>
                <div 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Total Paid
                </div>
                <div 
                  className="text-xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  ₹{stats.totalPaid.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div 
            className="border rounded-xl p-4"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <TrendingUp size={20} style={{ color: 'var(--color-wholesale)' }} />
              </div>
              <div>
                <div 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Active Tasks
                </div>
                <div 
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {stats.activeTasks}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2" 
              size={18}
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <Input
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2 border rounded-lg"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <option value="all">All Departments</option>
            <option value="dyeing">Dyeing</option>
            <option value="tailoring">Tailoring</option>
            <option value="handcraft">Handcraft</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Workers List */}
          <div className="space-y-4">
            <h3 
              className="text-lg font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Workers
            </h3>
            {filteredWorkers.map(worker => (
              <button
                key={worker.id}
                onClick={() => setSelectedWorker(worker)}
                className="w-full text-left p-4 rounded-xl border-2 transition-all"
                style={{
                  backgroundColor: selectedWorker?.id === worker.id
                    ? 'rgba(168, 85, 247, 0.1)'
                    : 'var(--color-bg-card)',
                  borderColor: selectedWorker?.id === worker.id
                    ? 'var(--color-wholesale)'
                    : 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-xl)'
                }}
                onMouseEnter={(e) => {
                  if (selectedWorker?.id !== worker.id) {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedWorker?.id !== worker.id) {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {worker.name}
                    </h4>
                    <p 
                      className="text-sm mt-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {worker.phone}
                    </p>
                  </div>
                  <Badge 
                    className="capitalize"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: 'var(--color-primary)',
                      borderColor: 'rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    {worker.department}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div style={{ color: 'var(--color-text-tertiary)' }}>Total Tasks</div>
                    <div 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {worker.totalTasks}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-text-tertiary)' }}>Completed</div>
                    <div 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {worker.completedTasks}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-text-tertiary)' }}>Pending Payment</div>
                    <div 
                      className="font-semibold"
                      style={{ color: 'var(--color-warning)' }}
                    >
                      ₹{worker.pendingPayment.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-text-tertiary)' }}>Total Earned</div>
                    <div 
                      className="font-semibold"
                      style={{ color: 'var(--color-success)' }}
                    >
                      ₹{worker.totalEarned.toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Worker Details & Tasks */}
          <div>
            {selectedWorker ? (
              <div 
                className="border rounded-xl p-6"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedWorker.name}
                    </h3>
                    <p 
                      className="text-sm mt-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {selectedWorker.department} Department
                    </p>
                  </div>
                  <div className="text-right">
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Pending
                    </div>
                    <div 
                      className="text-2xl font-bold"
                      style={{ color: 'var(--color-warning)' }}
                    >
                      ₹{selectedWorker.pendingPayment.toLocaleString()}
                    </div>
                  </div>
                </div>

                <h4 
                  className="text-lg font-semibold mb-4"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Task Ledger
                </h4>
                
                {selectedWorker.tasks.length > 0 ? (
                  <div className="space-y-3">
                    {selectedWorker.tasks.map(task => (
                      <div
                        key={task.id}
                        className="border rounded-lg p-4"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div 
                              className="font-semibold mb-1"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {task.invoiceNumber}
                            </div>
                            <div 
                              className="text-sm"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              {task.customerName}
                            </div>
                            <div 
                              className="text-sm mt-1"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              {task.description}
                            </div>
                          </div>
                          <Badge 
                            style={{
                              backgroundColor: task.paymentStatus === 'completed'
                                ? 'rgba(34, 197, 94, 0.2)'
                                : 'rgba(249, 115, 22, 0.2)',
                              color: task.paymentStatus === 'completed'
                                ? 'var(--color-success)'
                                : 'var(--color-warning)',
                              borderColor: task.paymentStatus === 'completed'
                                ? 'rgba(34, 197, 94, 0.3)'
                                : 'rgba(249, 115, 22, 0.3)'
                            }}
                          >
                            {task.paymentStatus === 'completed' ? '✓ Paid' : 'Pending'}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div 
                            className="text-xl font-bold"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            ₹{task.amount.toLocaleString()}
                          </div>
                          {task.paymentStatus === 'pending' && task.completedDate && (
                            <Button
                              size="sm"
                              onClick={() => handlePayment(selectedWorker.id, task.id)}
                              style={{
                                backgroundColor: 'var(--color-success)',
                                color: 'var(--color-text-primary)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.9)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-success)';
                              }}
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Pay Now
                            </Button>
                          )}
                        </div>

                        <div 
                          className="mt-3 pt-3 border-t text-xs space-y-1"
                          style={{
                            borderTopColor: 'var(--color-border-secondary)',
                            color: 'var(--color-text-tertiary)'
                          }}
                        >
                          <div>Assigned: {formatDate(new Date(task.assignedDate))}</div>
                          {task.completedDate && (
                            <div>Completed: {formatDate(new Date(task.completedDate))}</div>
                          )}
                          {task.paidDate && (
                            <div style={{ color: 'var(--color-success)' }}>Paid: {formatDate(new Date(task.paidDate))}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    className="text-center py-8"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <Clock size={48} className="mx-auto mb-2" style={{ opacity: 0.5 }} />
                    <p>No tasks assigned yet</p>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="border rounded-xl p-12 text-center"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                <Users size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                <h3 
                  className="text-lg font-semibold mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Select a Worker
                </h3>
                <p style={{ color: 'var(--color-text-tertiary)' }}>
                  Click on a worker to view their task ledger and payment details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
