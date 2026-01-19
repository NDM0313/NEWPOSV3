import React, { useState } from 'react';
import { 
  ArrowLeft,
  User,
  Phone,
  Calendar,
  Star,
  Palette,
  Scissors,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  TrendingUp,
  ChevronRight,
  Eye,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';

// ============================================
// 🎯 TYPES
// ============================================

type DepartmentType = 'Dyeing' | 'Stitching' | 'Handwork';
type JobStatus = 'pending' | 'in_progress' | 'completed';

interface WorkerJob {
  id: string;
  jobCardId: string;
  customerName: string;
  itemDescription: string;
  currentStage: DepartmentType;
  deadline: Date;
  status: JobStatus;
  assignedDate: Date;
  paymentAmount: number;
  isPaid: boolean;
}

interface WorkerDetail {
  id: string;
  name: string;
  phone: string;
  department: DepartmentType;
  rating: number;
  joinedDate: Date;
  
  // Job stats
  activeJobs: number;
  pendingJobs: number;
  completedJobs: number;
  
  // Financial (read-only indicators)
  totalEarnings: number;
  pendingAmount: number;
  
  // Current jobs
  currentJobs: WorkerJob[];
  
  // History
  recentCompletedJobs: WorkerJob[];
}

// ============================================
// 🎨 MOCK DATA
// ============================================

const mockWorkerDetail: WorkerDetail = {
  id: 'W001',
  name: 'Ahmed Ali',
  phone: '+92 300 1111111',
  department: 'Dyeing',
  rating: 4.5,
  joinedDate: new Date('2025-06-15'),
  
  activeJobs: 3,
  pendingJobs: 2,
  completedJobs: 45,
  
  totalEarnings: 145000,
  pendingAmount: 12500,
  
  currentJobs: [
    {
      id: 'J001',
      jobCardId: 'JC-2026-001',
      customerName: 'Ayesha Khan',
      itemDescription: 'Silk Lawn - Red (5m)',
      currentStage: 'Dyeing',
      deadline: new Date('2026-01-25'),
      status: 'in_progress',
      assignedDate: new Date('2026-01-10'),
      paymentAmount: 4500,
      isPaid: false
    },
    {
      id: 'J002',
      jobCardId: 'JC-2026-005',
      customerName: 'Fatima Ahmed',
      itemDescription: 'Cotton Lawn - Blue (8m)',
      currentStage: 'Dyeing',
      deadline: new Date('2026-01-28'),
      status: 'in_progress',
      assignedDate: new Date('2026-01-12'),
      paymentAmount: 5000,
      isPaid: false
    },
    {
      id: 'J003',
      jobCardId: 'JC-2026-008',
      customerName: 'Sarah Ali',
      itemDescription: 'Chiffon - Green (4m)',
      currentStage: 'Dyeing',
      deadline: new Date('2026-01-30'),
      status: 'in_progress',
      assignedDate: new Date('2026-01-14'),
      paymentAmount: 3000,
      isPaid: false
    }
  ],
  
  recentCompletedJobs: [
    {
      id: 'J004',
      jobCardId: 'JC-2026-002',
      customerName: 'Zara Malik',
      itemDescription: 'Organza - Purple (3m)',
      currentStage: 'Dyeing',
      deadline: new Date('2026-01-15'),
      status: 'completed',
      assignedDate: new Date('2026-01-05'),
      paymentAmount: 3500,
      isPaid: true
    },
    {
      id: 'J005',
      jobCardId: 'JC-2026-003',
      customerName: 'Hina Shah',
      itemDescription: 'Silk - Maroon (6m)',
      currentStage: 'Dyeing',
      deadline: new Date('2026-01-12'),
      status: 'completed',
      assignedDate: new Date('2026-01-03'),
      paymentAmount: 4200,
      isPaid: true
    }
  ]
};

// ============================================
// 🎨 HELPER FUNCTIONS
// ============================================

const getDepartmentColor = (dept: DepartmentType) => {
  switch (dept) {
    case 'Dyeing': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'Stitching': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Handwork': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
  }
};

const getDepartmentIcon = (dept: DepartmentType) => {
  switch (dept) {
    case 'Dyeing': return Palette;
    case 'Stitching': return Scissors;
    case 'Handwork': return Sparkles;
  }
};

const getJobStatusColor = (status: JobStatus) => {
  switch (status) {
    case 'pending': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    case 'in_progress': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
  }
};

const getJobStatusIcon = (status: JobStatus) => {
  switch (status) {
    case 'pending': return Clock;
    case 'in_progress': return AlertTriangle;
    case 'completed': return CheckCircle2;
  }
};

// ============================================
// 🎯 MAIN COMPONENT
// ============================================

export const WorkerDetailPage: React.FC = () => {
  const [worker] = useState<WorkerDetail>(mockWorkerDetail);
  const DeptIcon = getDepartmentIcon(worker.department);

  const handleGoBack = () => {
    window.close(); // Close the tab
    // Or use router to go back
  };

  const handleGoToAccounting = () => {
    console.log('Navigate to Accounting for worker:', worker.id);
    // Navigate to accounting module with worker filter
  };

  const handleViewJob = (jobId: string) => {
    console.log('View job detail:', jobId);
    // Navigate to job detail page
  };

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft size={18} className="mr-2" />
                Back to Workers
              </Button>
              <div className="h-6 w-px bg-gray-700" />
              <h1 className="text-xl font-bold text-white">Worker Detail</h1>
            </div>
            
            <Button
              onClick={handleGoToAccounting}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
            >
              <ExternalLink size={16} />
              View Full Ledger
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        
        {/* Worker Summary */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl">
                {worker.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{worker.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Phone size={14} />
                    {worker.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Joined {format(worker.joinedDate, 'MMM dd, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    {worker.rating.toFixed(1)} Rating
                  </span>
                </div>
                <div className="mt-3">
                  <Badge variant="outline" className={getDepartmentColor(worker.department)}>
                    <DeptIcon size={14} className="mr-1" />
                    {worker.department} Department
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Active Jobs</p>
              <p className="text-3xl font-bold text-yellow-400">{worker.activeJobs}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Pending Jobs</p>
              <p className="text-3xl font-bold text-orange-400">{worker.pendingJobs}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-400">{worker.completedJobs}</p>
            </div>
            <div className="text-center border-l border-gray-800">
              <p className="text-gray-400 text-sm mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-blue-400">
                Rs {worker.totalEarnings.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Snapshot (Read-only) */}
        {worker.pendingAmount > 0 && (
          <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 font-semibold text-sm mb-1">⚠️ Pending Payment</p>
                <p className="text-3xl font-bold text-white">
                  Rs {worker.pendingAmount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  For {worker.currentJobs.filter(j => !j.isPaid).length} unpaid jobs
                </p>
              </div>
              <Button
                onClick={handleGoToAccounting}
                className="bg-orange-600 hover:bg-orange-500 text-white gap-2"
              >
                View in Accounting
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Current Jobs Section */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="text-yellow-400" size={20} />
                  Current Active Jobs
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {worker.currentJobs.length} jobs currently in progress
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Job Card</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Item Description</th>
                  <th className="px-6 py-3 font-medium">Deadline</th>
                  <th className="px-6 py-3 font-medium text-right">Payment</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                  <th className="px-6 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {worker.currentJobs.map((job) => {
                  const StatusIcon = getJobStatusIcon(job.status);
                  const daysUntilDeadline = Math.ceil(
                    (job.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <tr key={job.id} className="group hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-mono text-blue-400 font-medium">{job.jobCardId}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Assigned {format(job.assignedDate, 'MMM dd')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-medium">{job.customerName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-300">{job.itemDescription}</p>
                        <Badge variant="outline" className={`${getDepartmentColor(job.currentStage)} mt-1`}>
                          {job.currentStage}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{format(job.deadline, 'MMM dd, yyyy')}</p>
                        <p className={`text-xs mt-1 ${
                          daysUntilDeadline < 3 ? 'text-red-400' : 
                          daysUntilDeadline < 7 ? 'text-yellow-400' : 
                          'text-gray-500'
                        }`}>
                          {daysUntilDeadline} days left
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-white">
                          Rs {job.paymentAmount.toLocaleString()}
                        </p>
                        {!job.isPaid && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 mt-1">
                            Unpaid
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className={getJobStatusColor(job.status)}>
                          <StatusIcon size={12} className="mr-1" />
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => handleViewJob(job.id)}
                        >
                          <Eye size={16} className="mr-2" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Job History Section */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="text-green-400" size={20} />
                  Recent Completed Jobs
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Last {worker.recentCompletedJobs.length} completed assignments
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Job Card</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Item Description</th>
                  <th className="px-6 py-3 font-medium">Completed Date</th>
                  <th className="px-6 py-3 font-medium text-right">Earned</th>
                  <th className="px-6 py-3 font-medium text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {worker.recentCompletedJobs.map((job) => (
                  <tr key={job.id} className="group hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-mono text-gray-400 font-medium">{job.jobCardId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300">{job.customerName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400">{job.itemDescription}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300">{format(job.deadline, 'MMM dd, yyyy')}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-green-400">
                        +Rs {job.paymentAmount.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                        <CheckCircle2 size={12} className="mr-1" />
                        Paid
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-950/50 border-t border-gray-800 text-center">
            <Button
              variant="ghost"
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
              onClick={handleGoToAccounting}
            >
              View Complete History in Accounting
              <ChevronRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
