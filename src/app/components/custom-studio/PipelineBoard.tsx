import React, { useState } from 'react';
import { 
  Scissors, 
  Palette, 
  Shirt, 
  CheckCircle2, 
  MoreHorizontal, 
  Calendar,
  Plus,
  ArrowRight,
  Trash2,
  Edit,
  MoveRight
} from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { Badge } from "../ui/badge";
import { useNavigation } from '../../context/NavigationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const initialColumns = [
  { id: 'cutting', title: 'Cutting', icon: Scissors, color: 'var(--color-primary)', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)' },
  { id: 'dyeing', title: 'Dyeing', icon: Palette, color: 'var(--color-wholesale)', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.2)' },
  { id: 'stitching', title: 'Stitching', icon: Shirt, color: 'var(--color-warning)', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.2)' },
  { id: 'ready', title: 'Ready', icon: CheckCircle2, color: 'var(--color-success)', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)' },
];

const initialTasksData = [
  { id: '1', orderId: 'ORD-8821', customer: 'Mrs. Saad', item: 'Red Bridal Lehenga', status: 'dyeing', type: 'Retail', due: '12 Jan' },
  { id: '2', orderId: 'ORD-8822', customer: 'Bridal Boutique', item: '10x Chiffon Suits', status: 'cutting', type: 'Wholesale', due: '15 Jan' },
  { id: '3', orderId: 'ORD-8823', customer: 'Zara Ahmed', item: 'Velvet Shawl', status: 'stitching', type: 'Retail', due: '10 Jan' },
  { id: '4', orderId: 'ORD-8824', customer: 'Ali Textiles', item: '50x Lawn Sets', status: 'cutting', type: 'Wholesale', due: '20 Jan' },
  { id: '5', orderId: 'ORD-8825', customer: 'Walk-in', item: 'Mens Sherwani', status: 'ready', type: 'Retail', due: '05 Jan' },
];

export const PipelineBoard = () => {
  const { setCurrentView } = useNavigation();
  const [tasks, setTasks] = useState(initialTasksData);

  const handleMoveNext = (taskId: string, currentStatus: string) => {
    const statusOrder = ['cutting', 'dyeing', 'stitching', 'ready'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    
    if (currentIndex < statusOrder.length - 1) {
      const nextStatus = statusOrder[currentIndex + 1];
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleClearColumn = (columnId: string) => {
    setTasks(tasks.filter(t => t.status !== columnId));
  };

  return (
    <div 
      className="flex flex-col h-full animate-in fade-in duration-300"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}
    >
      
      {/* Header */}
      <div 
        className="flex items-center justify-between p-6 border-b"
        style={{
          borderColor: 'var(--color-border-primary)',
          backgroundColor: 'rgba(17, 24, 39, 0.5)'
        }}
      >
        <div>
          <h1 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Production Pipeline
          </h1>
          <p 
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Track orders through manufacturing stages.
          </p>
        </div>
        <Button 
          onClick={() => setCurrentView('custom-new-order' as any)}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> New Order
        </Button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 min-w-[1000px] h-full">
          {initialColumns.map((col) => (
            <div key={col.id} className="flex-1 flex flex-col min-w-[280px]">
              {/* Column Header */}
              <div 
                className="flex items-center justify-between p-3 rounded-t-lg border-t border-x backdrop-blur"
                style={{
                  backgroundColor: col.bg,
                  borderColor: col.border,
                  borderRadius: 'var(--radius-lg) 0 0 0'
                }}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <col.icon size={18} style={{ color: col.color }} />
                  <span style={{ color: 'var(--color-text-primary)' }}>{col.title}</span>
                  <Badge 
                    variant="secondary" 
                    className="border-0 text-xs ml-2"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    {tasks.filter(t => t.status === col.id).length}
                  </Badge>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-40"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <DropdownMenuLabel>Column Options</DropdownMenuLabel>
                    <DropdownMenuSeparator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                    <DropdownMenuItem 
                      className="cursor-pointer"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--color-error)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => handleClearColumn(col.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Clear All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Column Content */}
              <div 
                className="flex-1 border-x border-b rounded-b-lg p-3 space-y-3"
                style={{
                  backgroundColor: 'rgba(31, 41, 55, 0.3)',
                  borderColor: col.border,
                  borderRadius: '0 0 var(--radius-lg) var(--radius-lg)'
                }}
              >
                {tasks
                  .filter(task => task.status === col.id)
                  .map(task => (
                    <div 
                      key={task.id} 
                      className="border p-4 rounded-lg shadow-sm transition-colors cursor-pointer group relative"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }}
                      onClick={() => setCurrentView('production-detail' as any)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span 
                          className="text-xs font-mono"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          {task.orderId}
                        </span>
                        {task.type === 'Wholesale' && (
                          <span 
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                            style={{
                              color: 'var(--color-wholesale)',
                              backgroundColor: 'rgba(168, 85, 247, 0.3)',
                              borderColor: 'rgba(168, 85, 247, 0.2)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            WHOLESALE
                          </span>
                        )}
                        
                        <div 
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={(e) => e.stopPropagation()}
                        >
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = 'var(--color-text-primary)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <MoreHorizontal size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent 
                                align="end" 
                                className="w-40"
                                style={{
                                  backgroundColor: 'var(--color-bg-card)',
                                  borderColor: 'var(--color-border-primary)',
                                  color: 'var(--color-text-primary)'
                                }}
                              >
                                <DropdownMenuItem 
                                  className="cursor-pointer"
                                  style={{
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-text-primary)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                  onClick={() => setCurrentView('production-detail' as any)}
                                >
                                  <Edit className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                
                                {col.id !== 'ready' && (
                                  <DropdownMenuItem 
                                    className="cursor-pointer"
                                    style={{
                                      backgroundColor: 'transparent',
                                      color: 'var(--color-text-primary)'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                    onClick={() => handleMoveNext(task.id, task.status)}
                                  >
                                    <MoveRight className="mr-2 h-4 w-4" /> Move Next
                                  </DropdownMenuItem>
                                )}
                                
                                <DropdownMenuSeparator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                                <DropdownMenuItem 
                                  className="cursor-pointer"
                                  style={{
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-error)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                  onClick={() => handleDeleteTask(task.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      </div>
                      <h4 
                        className="font-bold mb-1 pr-6"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {task.item}
                      </h4>
                      <p 
                        className="text-sm mb-3"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {task.customer}
                      </p>
                      
                      <div 
                        className="flex items-center justify-between text-xs pt-3 border-t"
                        style={{
                          color: 'var(--color-text-tertiary)',
                          borderColor: 'rgba(55, 65, 81, 0.5)'
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          <span>{task.due}</span>
                        </div>
                        <div 
                          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border"
                          style={{
                            background: 'linear-gradient(to top right, var(--color-bg-tertiary), var(--color-bg-secondary))',
                            color: 'var(--color-text-primary)',
                            borderColor: 'var(--color-border-secondary)',
                            borderRadius: 'var(--radius-full)'
                          }}
                        >
                          {task.customer.charAt(0)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
