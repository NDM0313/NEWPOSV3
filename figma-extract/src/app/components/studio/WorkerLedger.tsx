import React, { useState } from 'react';
import { X, Users, DollarSign, CheckCircle, Clock, Search, Filter, TrendingUp } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

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
    <div className="min-h-screen bg-[#111827] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-purple-400" size={28} />
              Worker Accounts & Payment Ledger
            </h2>
            <p className="text-gray-400 mt-1">Track worker tasks and manage payments</p>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-900 border-gray-800 text-gray-300"
          >
            <X size={16} className="mr-2" />
            Close
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Workers</div>
                <div className="text-2xl font-bold text-white">{stats.totalWorkers}</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Clock size={20} className="text-orange-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Pending Payment</div>
                <div className="text-xl font-bold text-white">₹{stats.totalPending.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle size={20} className="text-green-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Paid</div>
                <div className="text-xl font-bold text-white">₹{stats.totalPaid.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp size={20} className="text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Active Tasks</div>
                <div className="text-2xl font-bold text-white">{stats.activeTasks}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <Input
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-800 text-white"
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white"
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
            <h3 className="text-lg font-semibold text-white">Workers</h3>
            {filteredWorkers.map(worker => (
              <button
                key={worker.id}
                onClick={() => setSelectedWorker(worker)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  selectedWorker?.id === worker.id
                    ? 'bg-purple-500/10 border-purple-500'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-white font-semibold">{worker.name}</h4>
                    <p className="text-sm text-gray-400 mt-1">{worker.phone}</p>
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 capitalize">
                    {worker.department}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Total Tasks</div>
                    <div className="text-white font-semibold">{worker.totalTasks}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Completed</div>
                    <div className="text-white font-semibold">{worker.completedTasks}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Pending Payment</div>
                    <div className="text-orange-400 font-semibold">₹{worker.pendingPayment.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total Earned</div>
                    <div className="text-green-400 font-semibold">₹{worker.totalEarned.toLocaleString()}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Worker Details & Tasks */}
          <div>
            {selectedWorker ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedWorker.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{selectedWorker.department} Department</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Pending</div>
                    <div className="text-2xl font-bold text-orange-400">
                      ₹{selectedWorker.pendingPayment.toLocaleString()}
                    </div>
                  </div>
                </div>

                <h4 className="text-lg font-semibold text-white mb-4">Task Ledger</h4>
                
                {selectedWorker.tasks.length > 0 ? (
                  <div className="space-y-3">
                    {selectedWorker.tasks.map(task => (
                      <div
                        key={task.id}
                        className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-white font-semibold mb-1">{task.invoiceNumber}</div>
                            <div className="text-sm text-gray-400">{task.customerName}</div>
                            <div className="text-sm text-gray-500 mt-1">{task.description}</div>
                          </div>
                          <Badge className={
                            task.paymentStatus === 'completed'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          }>
                            {task.paymentStatus === 'completed' ? '✓ Paid' : 'Pending'}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-xl font-bold text-white">
                            ₹{task.amount.toLocaleString()}
                          </div>
                          {task.paymentStatus === 'pending' && task.completedDate && (
                            <Button
                              size="sm"
                              onClick={() => handlePayment(selectedWorker.id, task.id)}
                              className="bg-green-600 hover:bg-green-500 text-white"
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Pay Now
                            </Button>
                          )}
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500 space-y-1">
                          <div>Assigned: {new Date(task.assignedDate).toLocaleDateString('en-GB')}</div>
                          {task.completedDate && (
                            <div>Completed: {new Date(task.completedDate).toLocaleDateString('en-GB')}</div>
                          )}
                          {task.paidDate && (
                            <div className="text-green-400">Paid: {new Date(task.paidDate).toLocaleDateString('en-GB')}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No tasks assigned yet</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                <Users size={48} className="mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-400 mb-2">Select a Worker</h3>
                <p className="text-gray-500">Click on a worker to view their task ledger and payment details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
