import { useState } from 'react';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Package, 
  Calendar, 
  Scissors, 
  Wallet, 
  Users, 
  FileText, 
  Settings,
  Check,
  ChevronRight,
  Sparkles,
  Zap,
  Shield,
  Smartphone,
  Layers,
  TrendingUp
} from 'lucide-react';

interface FeaturesShowcaseProps {
  onClose: () => void;
}

type ShowcaseTab = 'overview' | 'modules' | 'workflows' | 'capabilities';

export function FeaturesShowcase({ onClose }: FeaturesShowcaseProps) {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('overview');

  const systemStats = [
    { label: 'Complete Modules', value: '12', icon: Layers, color: 'text-[#6366F1]' },
    { label: 'Total Features', value: '100+', icon: Sparkles, color: 'text-[#10B981]' },
    { label: 'Report Types', value: '24+', icon: FileText, color: 'text-[#F59E0B]' },
    { label: 'Components', value: '50+', icon: Zap, color: 'text-[#EC4899]' },
  ];

  const keyFeatures = [
    {
      title: 'Mobile-First Design',
      description: 'Optimized for touch devices with large buttons and easy navigation',
      icon: Smartphone,
      color: 'from-[#6366F1] to-[#4F46E5]',
    },
    {
      title: 'Accounting-Driven',
      description: 'Double-entry bookkeeping system with complete financial tracking',
      icon: Wallet,
      color: 'from-[#10B981] to-[#059669]',
    },
    {
      title: 'Multi-Branch Support',
      description: 'Manage multiple locations from a single interface',
      icon: Shield,
      color: 'from-[#F59E0B] to-[#D97706]',
    },
    {
      title: 'Production Pipeline',
      description: '6-stage studio workflow for custom garment manufacturing',
      icon: TrendingUp,
      color: 'from-[#EC4899] to-[#DB2777]',
    },
  ];

  const modules = [
    {
      name: 'Sales Module',
      icon: ShoppingCart,
      color: 'from-[#6366F1] to-[#4F46E5]',
      features: [
        'Multi-step sales workflow (6 steps)',
        'Product variations (Size, Color, Fabric)',
        'Sale types: Regular & Studio',
        'Payment methods: Cash, Bank, Credit',
        'Advanced dashboard with filters',
        'Edit/Delete capabilities',
        'Bulk operations support',
        'Customer quick add',
        'Real-time stock checking',
        'Sales analytics',
      ],
      workflow: [
        'Select Sale Type (Regular/Studio)',
        'Choose Customer',
        'Add Products with Variations',
        'Review Sale Summary',
        'Process Payment',
        'Generate Confirmation',
      ],
    },
    {
      name: 'Purchase Module',
      icon: Package,
      color: 'from-[#10B981] to-[#059669]',
      features: [
        '5-step purchase workflow',
        'Supplier management',
        'Item variations support',
        'Payment terms: Cash/Credit',
        'Purchase history tracking',
        'Stock intake processing',
        'Supplier quick add',
        'Multi-item purchases',
      ],
      workflow: [
        'Select Supplier',
        'Add Purchase Items',
        'Set Payment Terms',
        'Review Purchase Details',
        'Confirm Purchase',
      ],
    },
    {
      name: 'Rental Module',
      icon: Calendar,
      color: 'from-[#F59E0B] to-[#D97706]',
      features: [
        'Rental booking system',
        'Delivery tracking',
        'Return processing',
        'Damage assessment',
        'Security deposit handling',
        'Rental period management',
        'Customer rental history',
        'Late fee calculation',
      ],
      workflow: [
        'Book Rental',
        'Process Delivery',
        'Track Rental Period',
        'Process Return',
        'Assess Condition',
        'Finalize Charges',
      ],
    },
    {
      name: 'Studio Module',
      icon: Scissors,
      color: 'from-[#8B5CF6] to-[#7C3AED]',
      features: [
        '6-stage production pipeline',
        'Worker assignment per stage',
        'Timeline tracking',
        'Status monitoring',
        'Multiple orders management',
        'Stage-wise progress',
        'Delivery scheduling',
        'Quality control checkpoint',
      ],
      workflow: [
        'Stage 1: Cutting',
        'Stage 2: Stitching',
        'Stage 3: Finishing',
        'Stage 4: Quality Check',
        'Stage 5: Packaging',
        'Stage 6: Delivery',
      ],
    },
    {
      name: 'Accounts Module',
      icon: Wallet,
      color: 'from-[#EF4444] to-[#DC2626]',
      features: [
        'General journal entries',
        'Account transfers',
        'Supplier payments',
        'Worker payments',
        'Expense recording',
        'Chart of accounts',
        'Double-entry bookkeeping',
        'Account balances',
        'Transaction history',
      ],
      workflow: [
        'Select Transaction Type',
        'Choose Accounts',
        'Enter Amount & Details',
        'Verify Entries',
        'Post to Ledger',
      ],
    },
    {
      name: 'Contacts Module',
      icon: Users,
      color: 'from-[#EC4899] to-[#DB2777]',
      features: [
        'Multi-role support (Customer/Supplier/Worker)',
        'Complete CRUD operations',
        'Role-specific fields',
        'Activity logging',
        'Search and filter',
        'Quick actions',
        'Contact details management',
        'Transaction history',
      ],
      workflow: [
        'Add/Select Contact',
        'Assign Roles',
        'Enter Details',
        'Save Contact',
        'View Activity Log',
      ],
    },
    {
      name: 'Reports Module',
      icon: FileText,
      color: 'from-[#3B82F6] to-[#2563EB]',
      features: [
        '6 report categories',
        '24+ report types',
        'Date range filters',
        'Quick date presets',
        'PDF export',
        'Print functionality',
        'Share capability',
        'Detailed invoice views',
        'Summary cards',
        'Transaction breakdown',
      ],
      workflow: [
        'Select Report Category',
        'Choose Report Type',
        'Set Date Range',
        'Apply Filters',
        'Generate Report',
        'Export/Print/Share',
      ],
    },
    {
      name: 'Settings Module',
      icon: Settings,
      color: 'from-[#6B7280] to-[#4B5563]',
      features: [
        'Profile management',
        'Role-based permissions view',
        'App preferences',
        'Data backup/sync',
        'About information',
        'Theme settings',
        'Notification preferences',
      ],
      workflow: [
        'Access Settings',
        'Select Section',
        'Modify Preferences',
        'Save Changes',
      ],
    },
  ];

  const reportCategories = [
    {
      name: 'Sales Reports',
      icon: ShoppingCart,
      reports: [
        'Daily Sales Summary',
        'Monthly Sales Report',
        'Customer-wise Sales',
        'Product-wise Sales',
        'Sales by Category',
        'Payment Analysis',
      ],
    },
    {
      name: 'Purchase Reports',
      icon: Package,
      reports: [
        'Purchase Summary',
        'Supplier-wise Purchase',
        'Item-wise Purchase',
        'Payment Status',
      ],
    },
    {
      name: 'Worker Reports',
      icon: Users,
      reports: [
        'Worker Ledger (Detailed)',
        'Payment History',
        'Work Summary',
        'Performance Tracking',
      ],
    },
    {
      name: 'Account Reports',
      icon: Wallet,
      reports: [
        'Account Ledger',
        'Day Book',
        'Cash Summary',
        'Bank Summary',
        'Payables Report',
        'Receivables Report',
      ],
    },
  ];

  const capabilities = [
    {
      category: 'User Experience',
      items: [
        'iOS-style date/time picker',
        'Dark theme throughout',
        'Touch-optimized (44px+ targets)',
        'Auto-focus on inputs',
        'Numeric keyboard optimization',
        'Long-press actions',
        'Pull-to-refresh',
        'Swipe gestures',
      ],
    },
    {
      category: 'Data Management',
      items: [
        'Search across modules',
        'Advanced filtering',
        'Sorting options',
        'Bulk operations',
        'Data export (PDF)',
        'Print functionality',
        'Share capability',
        'Activity logging',
      ],
    },
    {
      category: 'Accounting Features',
      items: [
        'Double-entry bookkeeping',
        'Chart of accounts',
        'Journal entries',
        'Account transfers',
        'Payment tracking',
        'Balance calculations',
        'Financial reports',
        'Trial balance',
      ],
    },
    {
      category: 'Workflow Management',
      items: [
        'Multi-step processes',
        'Progress tracking',
        'Status indicators',
        'Timeline visualization',
        'Worker assignment',
        'Stage management',
        'Approval workflows',
        'Notifications',
      ],
    },
    {
      category: 'Mobile Features',
      items: [
        'Responsive design',
        'Bottom navigation (mobile)',
        'Sidebar navigation (tablet)',
        'Offline-ready structure',
        'Quick actions',
        'Minimal data usage',
        'Fast loading',
        'Battery efficient',
      ],
    },
    {
      category: 'Security & Access',
      items: [
        'Role-based access (Admin/Manager/Staff/Viewer)',
        'Branch-level access',
        'User authentication',
        'Session management',
        'Activity tracking',
        'Permission management',
        'Data validation',
        'Error handling',
      ],
    },
  ];

  // Overview Tab
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] rounded-2xl p-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Complete ERP Solution</h2>
        <p className="text-white/90 text-sm mb-4">
          Mobile-first ERP system designed for textile & garment businesses
        </p>
        <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-medium">Production Ready</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {systemStats.map((stat) => (
          <div key={stat.label} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <stat.icon className={`w-6 h-6 ${stat.color} mb-2`} />
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Key Features */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Key Features</h3>
        <div className="space-y-3">
          {keyFeatures.map((feature) => (
            <div
              key={feature.title}
              className="bg-[#1F2937] border border-[#374151] rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}>
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">{feature.title}</h4>
                  <p className="text-xs text-[#9CA3AF]">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What's Included */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">What's Included</h3>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
          {[
            '12 Complete Business Modules',
            '100+ Production-Ready Features',
            '24+ Comprehensive Reports',
            '50+ Reusable Components',
            'Dark Theme Design System',
            'Mobile + Tablet Responsive',
            'Role-Based Access Control',
            'Multi-Branch Support',
            'Accounting Architecture',
            'Complete Documentation',
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-[#10B981]" />
              </div>
              <p className="text-sm text-white">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Modules Tab
  const renderModules = () => (
    <div className="space-y-4">
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <p className="text-sm text-[#9CA3AF]">
          Tap any module to view detailed features and workflow
        </p>
      </div>

      {modules.map((module) => (
        <ModuleCard key={module.name} module={module} />
      ))}
    </div>
  );

  // Workflows Tab
  const renderWorkflows = () => (
    <div className="space-y-6">
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Step-by-Step Workflows</h3>
        <p className="text-xs text-[#9CA3AF]">
          Each module follows a carefully designed multi-step process
        </p>
      </div>

      {modules.map((module) => (
        <div key={module.name} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center`}>
              <module.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{module.name}</h4>
              <p className="text-xs text-[#9CA3AF]">{module.workflow.length} Steps</p>
            </div>
          </div>

          <div className="space-y-2">
            {module.workflow.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#6366F1]">{index + 1}</span>
                </div>
                <p className="text-sm text-white flex-1">{step}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // Capabilities Tab
  const renderCapabilities = () => (
    <div className="space-y-4">
      {capabilities.map((cap) => (
        <div key={cap.category} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">{cap.category}</h3>
          <div className="space-y-2">
            {cap.items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1]"></div>
                <p className="text-sm text-[#9CA3AF]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Report Categories */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Available Reports</h3>
        <div className="space-y-3">
          {reportCategories.map((category) => (
            <div key={category.name}>
              <div className="flex items-center gap-2 mb-2">
                <category.icon className="w-4 h-4 text-[#6366F1]" />
                <h4 className="text-sm font-medium text-white">{category.name}</h4>
              </div>
              <div className="pl-6 space-y-1">
                {category.reports.map((report, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#9CA3AF]"></div>
                    <p className="text-xs text-[#9CA3AF]">{report}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Features & Methods</h1>
            <p className="text-xs text-white/80">Complete system capabilities</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-white text-[#6366F1]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'modules'
                ? 'bg-white text-[#6366F1]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Modules
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'workflows'
                ? 'bg-white text-[#6366F1]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('capabilities')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'capabilities'
                ? 'bg-white text-[#6366F1]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            All Features
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'modules' && renderModules()}
        {activeTab === 'workflows' && renderWorkflows()}
        {activeTab === 'capabilities' && renderCapabilities()}
      </div>
    </div>
  );
}

// Module Card Component with Expand/Collapse
function ModuleCard({ module }: { module: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-[#374151]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center`}>
            <module.icon className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">{module.name}</h3>
            <p className="text-xs text-[#9CA3AF]">{module.features.length} Features</p>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-[#9CA3AF] transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#374151] p-4 space-y-4">
          {/* Features */}
          <div>
            <h4 className="text-xs font-semibold text-[#9CA3AF] mb-2">FEATURES</h4>
            <div className="space-y-2">
              {module.features.map((feature: string, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white">{feature}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow */}
          <div>
            <h4 className="text-xs font-semibold text-[#9CA3AF] mb-2">WORKFLOW</h4>
            <div className="space-y-2">
              {module.workflow.map((step: string, index: number) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#6366F1]">{index + 1}</span>
                  </div>
                  <p className="text-sm text-white">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
