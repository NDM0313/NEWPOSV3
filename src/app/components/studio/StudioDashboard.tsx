import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioService } from '@/app/services/studioService';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
    Palette, 
    Sparkles, 
    Scissors, 
    CheckCircle, 
    User, 
    DollarSign,
    Ruler,
    Search,
    Filter,
    ChevronRight,
    Clock,
    AlertCircle,
    Lock,
    Unlock,
    Timer,
    AlertTriangle
} from 'lucide-react';

// Mock data removed - loading from Supabase via studioService
// Legacy mock data structure kept for reference only
const _legacyProductionJobs = [
    {
        id: 'JC-001',
        saleNumber: 'SALE-2547',
        customer: 'Fatima Khan',
        fabricType: 'Silk Thaan - 15m',
        status: 'dyeing',
        progress: 33,
        deadline: '2026-01-15',
        priority: 'high',
        branchId: 'BRN-001',
        branchName: 'Main Store',
        createdAt: '2026-01-08 10:30 AM',
        daysInStage: 1,
        stages: {
            dyeing: { 
                status: 'in-progress', 
                worker: 'Ali Raza', 
                material: '15m', 
                cost: 5000,
                startedAt: '2026-01-08 11:00 AM',
                completedAt: null,
                paymentStatus: 'pending',
                isLocked: false
            },
            handwork: { 
                status: 'pending', 
                worker: null, 
                material: null, 
                cost: null,
                startedAt: null,
                completedAt: null,
                paymentStatus: 'pending',
                isLocked: true // Locked until dyeing completes
            },
            stitching: { 
                status: 'pending', 
                worker: null, 
                material: null, 
                cost: null,
                startedAt: null,
                completedAt: null,
                paymentStatus: 'pending',
                isLocked: true, // Locked until handwork completes
                measurements: {
                    length: '44',
                    chest: '40',
                    waist: '36',
                    sleeve: '22'
                }
            }
        }
    },
    {
        id: 'JC-002',
        saleNumber: 'SALE-2548',
        customer: 'Sarah Ahmed',
        fabricType: 'Cotton Thaan - 20m',
        status: 'handwork',
        progress: 66,
        deadline: '2026-01-18',
        priority: 'medium',
        branchId: 'BRN-001',
        branchName: 'Main Store',
        createdAt: '2026-01-07 02:15 PM',
        daysInStage: 2,
        stages: {
            dyeing: { 
                status: 'completed', 
                worker: 'Ali Raza', 
                material: '20m', 
                cost: 4000,
                startedAt: '2026-01-07 03:00 PM',
                completedAt: '2026-01-08 05:00 PM',
                paymentStatus: 'paid',
                isLocked: false
            },
            handwork: { 
                status: 'in-progress', 
                worker: 'Zainab Bibi', 
                material: '20m', 
                cost: 8000,
                startedAt: '2026-01-08 06:00 PM',
                completedAt: null,
                paymentStatus: 'pending',
                isLocked: false // Unlocked because dyeing is complete
            },
            stitching: { 
                status: 'pending', 
                worker: null, 
                material: null, 
                cost: null,
                startedAt: null,
                completedAt: null,
                paymentStatus: 'pending',
                isLocked: true, // Still locked
                measurements: {
                    length: '42',
                    chest: '38',
                    waist: '34',
                    sleeve: '21'
                }
            }
        }
    },
    {
        id: 'JC-003',
        saleNumber: 'SALE-2549',
        customer: 'Ayesha Malik',
        fabricType: 'Lawn Thaan - 12m',
        status: 'stitching',
        progress: 85,
        deadline: '2026-01-12',
        priority: 'high',
        branchId: 'BRN-001',
        branchName: 'Main Store',
        createdAt: '2026-01-06 09:00 AM',
        daysInStage: 1,
        stages: {
            dyeing: { 
                status: 'completed', 
                worker: 'Ali Raza', 
                material: '12m', 
                cost: 3000,
                startedAt: '2026-01-06 10:00 AM',
                completedAt: '2026-01-07 04:00 PM',
                paymentStatus: 'paid',
                isLocked: false
            },
            handwork: { 
                status: 'completed', 
                worker: 'Zainab Bibi', 
                material: '12m', 
                cost: 6000,
                startedAt: '2026-01-07 05:00 PM',
                completedAt: '2026-01-08 11:00 AM',
                paymentStatus: 'paid',
                isLocked: false
            },
            stitching: { 
                status: 'in-progress', 
                worker: 'Hassan Tailor', 
                material: '12m', 
                cost: 7000,
                startedAt: '2026-01-08 12:00 PM',
                completedAt: null,
                paymentStatus: 'pending',
                isLocked: false, // Unlocked
                measurements: {
                    length: '46',
                    chest: '42',
                    waist: '38',
                    sleeve: '23'
                }
            }
        }
    },
    {
        id: 'JC-004',
        saleNumber: 'SALE-2546',
        customer: 'Mariam Siddiqui',
        fabricType: 'Chiffon Thaan - 18m',
        status: 'completed',
        progress: 100,
        deadline: '2026-01-10',
        priority: 'low',
        branchId: 'BRN-001',
        branchName: 'Main Store',
        createdAt: '2026-01-05 01:00 PM',
        daysInStage: 0,
        stages: {
            dyeing: { 
                status: 'completed', 
                worker: 'Ali Raza', 
                material: '18m', 
                cost: 4500,
                startedAt: '2026-01-05 02:00 PM',
                completedAt: '2026-01-06 06:00 PM',
                paymentStatus: 'paid',
                isLocked: false
            },
            handwork: { 
                status: 'completed', 
                worker: 'Zainab Bibi', 
                material: '18m', 
                cost: 9000,
                startedAt: '2026-01-06 07:00 PM',
                completedAt: '2026-01-07 03:00 PM',
                paymentStatus: 'paid',
                isLocked: false
            },
            stitching: { 
                status: 'completed', 
                worker: 'Hassan Tailor', 
                material: '18m', 
                cost: 8500,
                startedAt: '2026-01-07 04:00 PM',
                completedAt: '2026-01-09 11:00 AM',
                paymentStatus: 'paid',
                isLocked: false,
                measurements: {
                    length: '43',
                    chest: '39',
                    waist: '35',
                    sleeve: '22'
                }
            }
        }
    }
];

    // Calculate status counts from real data
    const statusCards = [
        { title: 'Dyeing (Dahair)', count: productionJobs.filter(j => j.status === 'dyeing').length, icon: Palette, color: 'purple', status: 'dyeing' },
        { title: 'Handwork', count: productionJobs.filter(j => j.status === 'handwork').length, icon: Sparkles, color: 'pink', status: 'handwork' },
        { title: 'Stitching (Tailor)', count: productionJobs.filter(j => j.status === 'stitching').length, icon: Scissors, color: 'blue', status: 'stitching' },
        { title: 'Completed', count: productionJobs.filter(j => j.status === 'completed').length, icon: CheckCircle, color: 'green', status: 'completed' }
    ];

export function StudioDashboard() {
    const { companyId, branchId } = useSupabase();
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [productionJobs, setProductionJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Load production jobs from Supabase
    const loadProductionJobs = useCallback(async () => {
        if (!companyId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const orders = await studioService.getAllStudioOrders(companyId, branchId || undefined);
            
            // Convert to production jobs format
            const jobs = orders.map(order => {
                const jobCards = order.job_cards || [];
                const activeJob = jobCards.find((jc: any) => jc.status === 'in_progress');
                const status = activeJob ? activeJob.task_type : 
                              (order.status === 'completed' ? 'completed' : 
                              (order.status === 'pending' ? 'pending' : 'dyeing'));
                
                return {
                    id: order.id,
                    saleNumber: order.order_no || `ORD-${order.id?.slice(0, 8)}`,
                    customer: order.customer_name || 'Unknown',
                    fabricType: order.items?.[0]?.item_description || 'N/A',
                    status,
                    progress: order.status === 'completed' ? 100 : 
                             (order.status === 'in_progress' ? 50 : 0),
                    deadline: order.delivery_date || '',
                    priority: 'normal',
                    branchId: order.branch_id,
                    branchName: '',
                    createdAt: order.order_date,
                    daysInStage: 0,
                    stages: {}
                };
            });
            
            setProductionJobs(jobs);
        } catch (error) {
            console.error('[STUDIO DASHBOARD] Error loading production jobs:', error);
            toast.error('Failed to load production jobs');
            setProductionJobs([]);
        } finally {
            setLoading(false);
        }
    }, [companyId, branchId]);

    useEffect(() => {
        loadProductionJobs();
    }, [loadProductionJobs]);

    const filteredJobs = filterStatus === 'all' 
        ? productionJobs 
        : productionJobs.filter(j => j.status === filterStatus);

    const selectedJobData = productionJobs.find(j => j.id === selectedJob);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-lg text-gray-400">Loading production jobs...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Studio Production Dashboard</h1>
                    <p className="text-sm text-gray-400 mt-1">Din Collection - Fabric Processing & Manufacturing</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="border-gray-700 text-gray-300 h-9">
                        <Filter size={14} className="mr-2" />
                        Filter
                    </Button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <Input 
                            placeholder="Search job cards..."
                            className="pl-9 bg-gray-900 border-gray-800 text-white h-9 w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Status Cards - Top Bar */}
            <div className="grid grid-cols-4 gap-4">
                {statusCards.map((card) => {
                    const Icon = card.icon;
                    const isActive = filterStatus === card.status;
                    
                    return (
                        <Card 
                            key={card.status}
                            onClick={() => setFilterStatus(filterStatus === card.status ? 'all' : card.status)}
                            className={`bg-gray-900 border cursor-pointer transition-all ${
                                isActive 
                                    ? `border-${card.color}-500 bg-${card.color}-500/10` 
                                    : 'border-gray-800 hover:border-gray-700'
                            }`}
                        >
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`w-10 h-10 rounded-lg bg-${card.color}-500/20 flex items-center justify-center`}>
                                        <Icon className={`text-${card.color}-400`} size={20} />
                                    </div>
                                    <div className={`text-2xl font-bold text-${card.color}-400`}>
                                        {card.count}
                                    </div>
                                </div>
                                <div className="text-sm font-medium text-gray-300">{card.title}</div>
                                <div className="text-xs text-gray-500 mt-1">Active Jobs</div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-3 gap-6">
                {/* Production Queue Table - Left 2/3 */}
                <div className="col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Production Queue</h2>
                        <Badge className="bg-gray-800 text-gray-300">
                            {filteredJobs.length} Jobs
                        </Badge>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-800/50 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase">
                            <div className="col-span-2">Job Card</div>
                            <div className="col-span-3">Customer</div>
                            <div className="col-span-3">Fabric Type</div>
                            <div className="col-span-3">Progress</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-gray-800">
                            {filteredJobs.map((job) => {
                                const isSelected = selectedJob === job.id;
                                
                                return (
                                    <div 
                                        key={job.id}
                                        onClick={() => setSelectedJob(job.id)}
                                        className={`grid grid-cols-12 gap-4 px-4 py-4 cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-blue-500/10 border-l-2 border-l-blue-500' 
                                                : 'hover:bg-gray-800/50'
                                        }`}
                                    >
                                        <div className="col-span-2">
                                            <div className="font-medium text-white text-sm">{job.id}</div>
                                            <div className="flex items-center gap-1 mt-1">
                                                {job.priority === 'high' && (
                                                    <Badge className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                                                        HIGH
                                                    </Badge>
                                                )}
                                                {job.daysInStage > 2 && (
                                                    <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                                                        <Timer size={8} />
                                                        {job.daysInStage}d
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-span-3 text-sm text-gray-300">
                                            {job.customer}
                                        </div>
                                        <div className="col-span-3 text-sm text-gray-400">
                                            {job.fabricType}
                                        </div>
                                        <div className="col-span-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${
                                                            job.status === 'completed' ? 'bg-green-500' :
                                                            job.status === 'stitching' ? 'bg-blue-500' :
                                                            job.status === 'handwork' ? 'bg-pink-500' :
                                                            'bg-purple-500'
                                                        }`}
                                                        style={{ width: `${job.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-400 min-w-[35px]">
                                                    {job.progress}%
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                                <Clock size={10} />
                                                {job.deadline}
                                            </div>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-end">
                                            <ChevronRight size={16} className={isSelected ? 'text-blue-400' : 'text-gray-600'} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Production Flow - Right 1/3 */}
                <div className="col-span-1">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sticky top-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Production Flow</h2>
                        
                        {selectedJobData ? (
                            <div className="space-y-6">
                                {/* Job Header */}
                                <div className="pb-4 border-b border-gray-800">
                                    <div className="font-bold text-white">{selectedJobData.id}</div>
                                    <div className="text-sm text-gray-400">{selectedJobData.customer}</div>
                                    <div className="text-xs text-gray-500 mt-1">{selectedJobData.fabricType}</div>
                                </div>

                                {/* Vertical Stepper */}
                                <div className="space-y-6 relative">
                                    {/* Dyeing Stage */}
                                    <div className="relative">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                selectedJobData.stages.dyeing.status === 'completed' 
                                                    ? 'bg-purple-500' 
                                                    : selectedJobData.stages.dyeing.status === 'in-progress'
                                                    ? 'bg-purple-500 animate-pulse'
                                                    : 'bg-gray-800'
                                            }`}>
                                                <Palette size={14} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-purple-400 mb-2">Dyeing (Dahair)</div>
                                                {selectedJobData.stages.dyeing.worker && (
                                                    <div className="space-y-2">
                                                        <div className="bg-gray-800/50 rounded p-2">
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                <User size={10} />
                                                                <span className="text-gray-500">Worker</span>
                                                            </div>
                                                            <div className="text-xs text-white">{selectedJobData.stages.dyeing.worker}</div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-gray-800/50 rounded p-2">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                    <Ruler size={10} />
                                                                    <span className="text-gray-500">Material</span>
                                                                </div>
                                                                <div className="text-xs text-white">{selectedJobData.stages.dyeing.material}</div>
                                                            </div>
                                                            <div className="bg-gray-800/50 rounded p-2">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                    <DollarSign size={10} />
                                                                    <span className="text-gray-500">Cost</span>
                                                                </div>
                                                                <div className="text-xs text-white">Rs. {selectedJobData.stages.dyeing.cost?.toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedJobData.stages.dyeing.status === 'completed' && (
                                                    <Badge className="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0 mt-2">
                                                        Completed
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        {/* Connector Line */}
                                        <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-800 -mb-6"></div>
                                    </div>

                                    {/* Handwork Stage */}
                                    <div className="relative">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                selectedJobData.stages.handwork.status === 'completed' 
                                                    ? 'bg-pink-500' 
                                                    : selectedJobData.stages.handwork.status === 'in-progress'
                                                    ? 'bg-pink-500 animate-pulse'
                                                    : 'bg-gray-800'
                                            }`}>
                                                <Sparkles size={14} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-pink-400 mb-2">Handwork</div>
                                                {selectedJobData.stages.handwork.worker ? (
                                                    <div className="space-y-2">
                                                        <div className="bg-gray-800/50 rounded p-2">
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                <User size={10} />
                                                                <span className="text-gray-500">Worker</span>
                                                            </div>
                                                            <div className="text-xs text-white">{selectedJobData.stages.handwork.worker}</div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-gray-800/50 rounded p-2">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                    <Ruler size={10} />
                                                                    <span className="text-gray-500">Material</span>
                                                                </div>
                                                                <div className="text-xs text-white">{selectedJobData.stages.handwork.material}</div>
                                                            </div>
                                                            <div className="bg-gray-800/50 rounded p-2">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                    <DollarSign size={10} />
                                                                    <span className="text-gray-500">Cost</span>
                                                                </div>
                                                                <div className="text-xs text-white">Rs. {selectedJobData.stages.handwork.cost?.toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                        {selectedJobData.stages.handwork.status === 'completed' && (
                                                            <Badge className="bg-pink-500/20 text-pink-400 text-[10px] px-2 py-0">
                                                                Completed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-500 italic">Pending</div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Connector Line */}
                                        <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-800 -mb-6"></div>
                                    </div>

                                    {/* Stitching Stage */}
                                    <div className="relative">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                selectedJobData.stages.stitching.status === 'completed' 
                                                    ? 'bg-blue-500' 
                                                    : selectedJobData.stages.stitching.status === 'in-progress'
                                                    ? 'bg-blue-500 animate-pulse'
                                                    : 'bg-gray-800'
                                            }`}>
                                                <Scissors size={14} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-blue-400 mb-2">Stitching (Tailor)</div>
                                                {selectedJobData.stages.stitching.worker ? (
                                                    <div className="space-y-2">
                                                        <div className="bg-gray-800/50 rounded p-2">
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                <User size={10} />
                                                                <span className="text-gray-500">Worker</span>
                                                            </div>
                                                            <div className="text-xs text-white">{selectedJobData.stages.stitching.worker}</div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-gray-800/50 rounded p-2">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                    <Ruler size={10} />
                                                                    <span className="text-gray-500">Material</span>
                                                                </div>
                                                                <div className="text-xs text-white">{selectedJobData.stages.stitching.material}</div>
                                                            </div>
                                                            <div className="bg-gray-800/50 rounded p-2">
                                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                                                                    <DollarSign size={10} />
                                                                    <span className="text-gray-500">Cost</span>
                                                                </div>
                                                                <div className="text-xs text-white">Rs. {selectedJobData.stages.stitching.cost?.toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                        {selectedJobData.stages.stitching.status === 'completed' && (
                                                            <Badge className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0">
                                                                Completed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-gray-500 italic">Pending</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <AlertCircle className="mx-auto text-gray-700 mb-3" size={32} />
                                <div className="text-sm text-gray-500">Select a job card to view production flow</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}