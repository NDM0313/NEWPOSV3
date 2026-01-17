import React, { useState } from 'react';
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

// Mock data
const productionJobs = [
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

const statusCards = [
    { title: 'Dyeing (Dahair)', count: 1, icon: Palette, color: 'purple', status: 'dyeing' },
    { title: 'Handwork', count: 1, icon: Sparkles, color: 'pink', status: 'handwork' },
    { title: 'Stitching (Tailor)', count: 1, icon: Scissors, color: 'blue', status: 'stitching' },
    { title: 'Completed', count: 1, icon: CheckCircle, color: 'green', status: 'completed' }
];

export function StudioDashboard() {
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const filteredJobs = filterStatus === 'all' 
        ? productionJobs 
        : productionJobs.filter(j => j.status === filterStatus);

    const selectedJobData = productionJobs.find(j => j.id === selectedJob);

    return (
        <div 
            className="min-h-screen p-6 space-y-6"
            style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-primary)'
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 
                        className="text-2xl font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Studio Production Dashboard
                    </h1>
                    <p 
                        className="text-sm mt-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Din Collection - Fabric Processing & Manufacturing
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        className="h-9"
                        style={{
                            borderColor: 'var(--color-border-secondary)',
                            color: 'var(--color-text-secondary)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                    >
                        <Filter size={14} className="mr-2" />
                        Filter
                    </Button>
                    <div className="relative">
                        <Search 
                            className="absolute left-3 top-1/2 -translate-y-1/2" 
                            size={14}
                            style={{ color: 'var(--color-text-tertiary)' }}
                        />
                        <Input 
                            placeholder="Search job cards..."
                            className="pl-9 h-9 w-64"
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-primary)'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = 'var(--color-primary)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = 'var(--color-border-primary)';
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Status Cards - Top Bar */}
            <div className="grid grid-cols-4 gap-4">
                {statusCards.map((card) => {
                    const Icon = card.icon;
                    const isActive = filterStatus === card.status;
                    
                    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
                        purple: {
                            bg: 'rgba(147, 51, 234, 0.1)',
                            text: 'var(--color-wholesale)',
                            border: 'rgba(147, 51, 234, 0.5)'
                        },
                        pink: {
                            bg: 'rgba(236, 72, 153, 0.1)',
                            text: 'var(--color-primary)',
                            border: 'rgba(236, 72, 153, 0.5)'
                        },
                        blue: {
                            bg: 'rgba(59, 130, 246, 0.1)',
                            text: 'var(--color-primary)',
                            border: 'rgba(59, 130, 246, 0.5)'
                        },
                        green: {
                            bg: 'rgba(5, 150, 105, 0.1)',
                            text: 'var(--color-success)',
                            border: 'rgba(5, 150, 105, 0.5)'
                        }
                    };
                    
                    const colors = colorMap[card.color] || colorMap.blue;
                    
                    return (
                        <Card 
                            key={card.status}
                            onClick={() => setFilterStatus(filterStatus === card.status ? 'all' : card.status)}
                            className="border cursor-pointer transition-all"
                            style={{
                                backgroundColor: isActive 
                                    ? colors.bg 
                                    : 'var(--color-bg-card)',
                                borderColor: isActive 
                                    ? colors.border 
                                    : 'var(--color-border-primary)',
                                borderRadius: 'var(--radius-lg)'
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                                }
                            }}
                        >
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div 
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{
                                            backgroundColor: colors.bg,
                                            borderRadius: 'var(--radius-lg)'
                                        }}
                                    >
                                        <Icon size={20} style={{ color: colors.text }} />
                                    </div>
                                    <div 
                                        className="text-2xl font-bold"
                                        style={{ color: colors.text }}
                                    >
                                        {card.count}
                                    </div>
                                </div>
                                <div 
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    {card.title}
                                </div>
                                <div 
                                    className="text-xs mt-1"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                    Active Jobs
                                </div>
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
                        <h2 
                            className="text-lg font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Production Queue
                        </h2>
                        <Badge
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                color: 'var(--color-text-primary)'
                            }}
                        >
                            {filteredJobs.length} Jobs
                        </Badge>
                    </div>

                    <div 
                        className="border rounded-lg overflow-hidden"
                        style={{
                            backgroundColor: 'var(--color-bg-card)',
                            borderColor: 'var(--color-border-primary)',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        {/* Table Header */}
                        <div 
                            className="grid grid-cols-12 gap-4 px-4 py-3 border-b text-xs font-semibold uppercase"
                            style={{
                                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                borderBottomColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-secondary)'
                            }}
                        >
                            <div className="col-span-2">Job Card</div>
                            <div className="col-span-3">Customer</div>
                            <div className="col-span-3">Fabric Type</div>
                            <div className="col-span-3">Progress</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* Table Body */}
                        <div
                            style={{
                                borderColor: 'var(--color-border-primary)'
                            }}
                            className="divide-y"
                        >
                            {filteredJobs.map((job) => {
                                const isSelected = selectedJob === job.id;
                                
                                return (
                                    <div 
                                        key={job.id}
                                        onClick={() => setSelectedJob(job.id)}
                                        className="grid grid-cols-12 gap-4 px-4 py-4 cursor-pointer transition-all"
                                        style={{
                                            backgroundColor: isSelected 
                                                ? 'rgba(59, 130, 246, 0.1)' 
                                                : 'transparent',
                                            borderLeft: isSelected 
                                                ? '2px solid var(--color-primary)' 
                                                : 'none'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <div className="col-span-2">
                                            <div 
                                                className="font-medium text-sm"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {job.id}
                                            </div>
                                            <div className="flex items-center gap-1 mt-1">
                                                {job.priority === 'high' && (
                                                    <Badge 
                                                        className="text-[10px] px-1.5 py-0"
                                                        style={{
                                                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                                            color: 'var(--color-error)'
                                                        }}
                                                    >
                                                        HIGH
                                                    </Badge>
                                                )}
                                                {job.daysInStage > 2 && (
                                                    <Badge 
                                                        className="text-[10px] px-1.5 py-0 flex items-center gap-0.5"
                                                        style={{
                                                            backgroundColor: 'rgba(234, 179, 8, 0.2)',
                                                            color: 'var(--color-warning)'
                                                        }}
                                                    >
                                                        <Timer size={8} />
                                                        {job.daysInStage}d
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div 
                                            className="col-span-3 text-sm"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {job.customer}
                                        </div>
                                        <div 
                                            className="col-span-3 text-sm"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {job.fabricType}
                                        </div>
                                        <div className="col-span-3">
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="flex-1 h-2 rounded-full overflow-hidden"
                                                    style={{
                                                        backgroundColor: 'var(--color-bg-card)',
                                                        borderRadius: 'var(--radius-full)'
                                                    }}
                                                >
                                                    <div 
                                                        style={{ 
                                                            width: `${job.progress}%`,
                                                            height: '100%',
                                                            backgroundColor: job.status === 'completed' 
                                                                ? 'var(--color-success)' 
                                                                : job.status === 'stitching' 
                                                                  ? 'var(--color-primary)' 
                                                                  : job.status === 'handwork' 
                                                                    ? 'var(--color-primary)' 
                                                                    : 'var(--color-wholesale)'
                                                        }}
                                                    />
                                                </div>
                                                <span 
                                                    className="text-xs min-w-[35px]"
                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                >
                                                    {job.progress}%
                                                </span>
                                            </div>
                                            <div 
                                                className="flex items-center gap-1 mt-1 text-xs"
                                                style={{ color: 'var(--color-text-tertiary)' }}
                                            >
                                                <Clock size={10} />
                                                {job.deadline}
                                            </div>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-end">
                                            <ChevronRight 
                                                size={16} 
                                                style={{ 
                                                    color: isSelected 
                                                        ? 'var(--color-primary)' 
                                                        : 'var(--color-text-tertiary)' 
                                                }} 
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Production Flow - Right 1/3 */}
                <div className="col-span-1">
                    <div 
                        className="border rounded-lg p-4 sticky top-6"
                        style={{
                            backgroundColor: 'var(--color-bg-card)',
                            borderColor: 'var(--color-border-primary)',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        <h2 
                            className="text-lg font-semibold mb-4"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Production Flow
                        </h2>
                        
                        {selectedJobData ? (
                            <div className="space-y-6">
                                {/* Job Header */}
                                <div 
                                    className="pb-4 border-b"
                                    style={{
                                        borderBottomColor: 'var(--color-border-primary)'
                                    }}
                                >
                                    <div 
                                        className="font-bold"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        {selectedJobData.id}
                                    </div>
                                    <div 
                                        className="text-sm"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        {selectedJobData.customer}
                                    </div>
                                    <div 
                                        className="text-xs mt-1"
                                        style={{ color: 'var(--color-text-tertiary)' }}
                                    >
                                        {selectedJobData.fabricType}
                                    </div>
                                </div>

                                {/* Vertical Stepper */}
                                <div className="space-y-6 relative">
                                    {/* Dyeing Stage */}
                                    <div className="relative">
                                        <div className="flex items-start gap-3">
                                            <div 
                                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                                style={{
                                                    backgroundColor: selectedJobData.stages.dyeing.status === 'completed' 
                                                        ? 'var(--color-wholesale)' 
                                                        : selectedJobData.stages.dyeing.status === 'in-progress'
                                                        ? 'var(--color-wholesale)' 
                                                        : 'var(--color-bg-card)',
                                                    borderRadius: 'var(--radius-full)',
                                                    animation: selectedJobData.stages.dyeing.status === 'in-progress' 
                                                        ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
                                                        : 'none'
                                                }}
                                            >
                                                <Palette size={14} style={{ color: 'var(--color-text-primary)' }} />
                                            </div>
                                            <div className="flex-1">
                                                <div 
                                                    className="text-sm font-semibold mb-2"
                                                    style={{ color: 'var(--color-wholesale)' }}
                                                >
                                                    Dyeing (Dahair)
                                                </div>
                                                {selectedJobData.stages.dyeing.worker && (
                                                    <div className="space-y-2">
                                                        <div 
                                                            className="rounded p-2"
                                                            style={{
                                                                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                borderRadius: 'var(--radius-sm)'
                                                            }}
                                                        >
                                                            <div 
                                                                className="flex items-center gap-1.5 text-xs mb-1"
                                                                style={{ color: 'var(--color-text-secondary)' }}
                                                            >
                                                                <User size={10} />
                                                                <span style={{ color: 'var(--color-text-tertiary)' }}>Worker</span>
                                                            </div>
                                                            <div 
                                                                className="text-xs"
                                                                style={{ color: 'var(--color-text-primary)' }}
                                                            >
                                                                {selectedJobData.stages.dyeing.worker}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div 
                                                                className="rounded p-2"
                                                                style={{
                                                                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                    borderRadius: 'var(--radius-sm)'
                                                                }}
                                                            >
                                                                <div 
                                                                    className="flex items-center gap-1.5 text-xs mb-1"
                                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                                >
                                                                    <Ruler size={10} />
                                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Material</span>
                                                                </div>
                                                                <div 
                                                                    className="text-xs"
                                                                    style={{ color: 'var(--color-text-primary)' }}
                                                                >
                                                                    {selectedJobData.stages.dyeing.material}
                                                                </div>
                                                            </div>
                                                            <div 
                                                                className="rounded p-2"
                                                                style={{
                                                                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                    borderRadius: 'var(--radius-sm)'
                                                                }}
                                                            >
                                                                <div 
                                                                    className="flex items-center gap-1.5 text-xs mb-1"
                                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                                >
                                                                    <DollarSign size={10} />
                                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Cost</span>
                                                                </div>
                                                                <div 
                                                                    className="text-xs"
                                                                    style={{ color: 'var(--color-text-primary)' }}
                                                                >
                                                                    Rs. {selectedJobData.stages.dyeing.cost?.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedJobData.stages.dyeing.status === 'completed' && (
                                                    <Badge 
                                                        className="text-[10px] px-2 py-0 mt-2"
                                                        style={{
                                                            backgroundColor: 'rgba(147, 51, 234, 0.2)',
                                                            color: 'var(--color-wholesale)'
                                                        }}
                                                    >
                                                        Completed
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        {/* Connector Line */}
                                        <div 
                                            className="absolute left-4 top-8 bottom-0 w-px -mb-6"
                                            style={{ backgroundColor: 'var(--color-border-primary)' }}
                                        ></div>
                                    </div>

                                    {/* Handwork Stage */}
                                    <div className="relative">
                                        <div className="flex items-start gap-3">
                                            <div 
                                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                                style={{
                                                    backgroundColor: selectedJobData.stages.handwork.status === 'completed' 
                                                        ? 'var(--color-primary)' 
                                                        : selectedJobData.stages.handwork.status === 'in-progress'
                                                        ? 'var(--color-primary)' 
                                                        : 'var(--color-bg-card)',
                                                    borderRadius: 'var(--radius-full)',
                                                    animation: selectedJobData.stages.handwork.status === 'in-progress' 
                                                        ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
                                                        : 'none'
                                                }}
                                            >
                                                <Sparkles size={14} style={{ color: 'var(--color-text-primary)' }} />
                                            </div>
                                            <div className="flex-1">
                                                <div 
                                                    className="text-sm font-semibold mb-2"
                                                    style={{ color: 'var(--color-primary)' }}
                                                >
                                                    Handwork
                                                </div>
                                                {selectedJobData.stages.handwork.worker ? (
                                                    <div className="space-y-2">
                                                        <div 
                                                            className="rounded p-2"
                                                            style={{
                                                                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                borderRadius: 'var(--radius-sm)'
                                                            }}
                                                        >
                                                            <div 
                                                                className="flex items-center gap-1.5 text-xs mb-1"
                                                                style={{ color: 'var(--color-text-secondary)' }}
                                                            >
                                                                <User size={10} />
                                                                <span style={{ color: 'var(--color-text-tertiary)' }}>Worker</span>
                                                            </div>
                                                            <div 
                                                                className="text-xs"
                                                                style={{ color: 'var(--color-text-primary)' }}
                                                            >
                                                                {selectedJobData.stages.handwork.worker}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div 
                                                                className="rounded p-2"
                                                                style={{
                                                                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                    borderRadius: 'var(--radius-sm)'
                                                                }}
                                                            >
                                                                <div 
                                                                    className="flex items-center gap-1.5 text-xs mb-1"
                                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                                >
                                                                    <Ruler size={10} />
                                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Material</span>
                                                                </div>
                                                                <div 
                                                                    className="text-xs"
                                                                    style={{ color: 'var(--color-text-primary)' }}
                                                                >
                                                                    {selectedJobData.stages.handwork.material}
                                                                </div>
                                                            </div>
                                                            <div 
                                                                className="rounded p-2"
                                                                style={{
                                                                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                    borderRadius: 'var(--radius-sm)'
                                                                }}
                                                            >
                                                                <div 
                                                                    className="flex items-center gap-1.5 text-xs mb-1"
                                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                                >
                                                                    <DollarSign size={10} />
                                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Cost</span>
                                                                </div>
                                                                <div 
                                                                    className="text-xs"
                                                                    style={{ color: 'var(--color-text-primary)' }}
                                                                >
                                                                    Rs. {selectedJobData.stages.handwork.cost?.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {selectedJobData.stages.handwork.status === 'completed' && (
                                                            <Badge 
                                                                className="text-[10px] px-2 py-0"
                                                                style={{
                                                                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                                                                    color: 'var(--color-primary)'
                                                                }}
                                                            >
                                                                Completed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div 
                                                        className="text-xs italic"
                                                        style={{ color: 'var(--color-text-tertiary)' }}
                                                    >
                                                        Pending
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Connector Line */}
                                        <div 
                                            className="absolute left-4 top-8 bottom-0 w-px -mb-6"
                                            style={{ backgroundColor: 'var(--color-border-primary)' }}
                                        ></div>
                                    </div>

                                    {/* Stitching Stage */}
                                    <div className="relative">
                                        <div className="flex items-start gap-3">
                                            <div 
                                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                                style={{
                                                    backgroundColor: selectedJobData.stages.stitching.status === 'completed' 
                                                        ? 'var(--color-primary)' 
                                                        : selectedJobData.stages.stitching.status === 'in-progress'
                                                        ? 'var(--color-primary)' 
                                                        : 'var(--color-bg-card)',
                                                    borderRadius: 'var(--radius-full)',
                                                    animation: selectedJobData.stages.stitching.status === 'in-progress' 
                                                        ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
                                                        : 'none'
                                                }}
                                            >
                                                <Scissors size={14} style={{ color: 'var(--color-text-primary)' }} />
                                            </div>
                                            <div className="flex-1">
                                                <div 
                                                    className="text-sm font-semibold mb-2"
                                                    style={{ color: 'var(--color-primary)' }}
                                                >
                                                    Stitching (Tailor)
                                                </div>
                                                {selectedJobData.stages.stitching.worker ? (
                                                    <div className="space-y-2">
                                                        <div 
                                                            className="rounded p-2"
                                                            style={{
                                                                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                borderRadius: 'var(--radius-sm)'
                                                            }}
                                                        >
                                                            <div 
                                                                className="flex items-center gap-1.5 text-xs mb-1"
                                                                style={{ color: 'var(--color-text-secondary)' }}
                                                            >
                                                                <User size={10} />
                                                                <span style={{ color: 'var(--color-text-tertiary)' }}>Worker</span>
                                                            </div>
                                                            <div 
                                                                className="text-xs"
                                                                style={{ color: 'var(--color-text-primary)' }}
                                                            >
                                                                {selectedJobData.stages.stitching.worker}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div 
                                                                className="rounded p-2"
                                                                style={{
                                                                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                    borderRadius: 'var(--radius-sm)'
                                                                }}
                                                            >
                                                                <div 
                                                                    className="flex items-center gap-1.5 text-xs mb-1"
                                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                                >
                                                                    <Ruler size={10} />
                                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Material</span>
                                                                </div>
                                                                <div 
                                                                    className="text-xs"
                                                                    style={{ color: 'var(--color-text-primary)' }}
                                                                >
                                                                    {selectedJobData.stages.stitching.material}
                                                                </div>
                                                            </div>
                                                            <div 
                                                                className="rounded p-2"
                                                                style={{
                                                                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                                                                    borderRadius: 'var(--radius-sm)'
                                                                }}
                                                            >
                                                                <div 
                                                                    className="flex items-center gap-1.5 text-xs mb-1"
                                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                                >
                                                                    <DollarSign size={10} />
                                                                    <span style={{ color: 'var(--color-text-tertiary)' }}>Cost</span>
                                                                </div>
                                                                <div 
                                                                    className="text-xs"
                                                                    style={{ color: 'var(--color-text-primary)' }}
                                                                >
                                                                    Rs. {selectedJobData.stages.stitching.cost?.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {selectedJobData.stages.stitching.status === 'completed' && (
                                                            <Badge 
                                                                className="text-[10px] px-2 py-0"
                                                                style={{
                                                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                                                    color: 'var(--color-primary)'
                                                                }}
                                                            >
                                                                Completed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div 
                                                        className="text-xs italic"
                                                        style={{ color: 'var(--color-text-tertiary)' }}
                                                    >
                                                        Pending
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <AlertCircle 
                                    className="mx-auto mb-3" 
                                    size={32}
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                />
                                <div 
                                    className="text-sm"
                                    style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                    Select a job card to view production flow
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}