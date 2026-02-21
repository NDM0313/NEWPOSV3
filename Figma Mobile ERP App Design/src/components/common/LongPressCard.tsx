import { useRef, useState } from 'react';
import { MoreVertical, Eye, Edit2, Trash2, Copy } from 'lucide-react';

interface ActionMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  show?: boolean;
}

interface LongPressCardProps {
  onTap: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * GLOBAL LONG PRESS CARD COMPONENT
 * 
 * Features:
 * - Normal tap → onTap (usually opens detail)
 * - Long press → Shows three-dot menu
 * - Role-based actions (Edit/Delete based on permissions)
 * - Reusable across Sales, Purchase, Rental, Expense lists
 * 
 * Usage:
 * <LongPressCard 
 *   onTap={() => setSelectedSale(sale)}
 *   onEdit={() => editSale(sale)}
 *   onDelete={() => deleteSale(sale)}
 *   canEdit={user.role === 'admin'}
 *   canDelete={user.role === 'admin'}
 * >
 *   {/* Card content */}
 * </LongPressCard>
 */
export function LongPressCard({
  onTap,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  canEdit = true,
  canDelete = true,
  children,
  className = '',
}: LongPressCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressTriggered.current = false;
    const touch = e.touches[0];
    
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      // Vibrate on long press (if supported)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowMenu(true);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    
    if (!longPressTriggered.current) {
      // Normal tap
      onTap();
    }
  };

  const handleTouchMove = () => {
    // Cancel long press if finger moves
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Desktop: Right-click support
    if (e.button === 2) {
      e.preventDefault();
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setShowMenu(true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleMenuAction = (action: () => void) => {
    setShowMenu(false);
    action();
  };

  const menuItems: ActionMenuItem[] = [
    {
      label: 'View',
      icon: <Eye className="w-4 h-4" />,
      onClick: () => handleMenuAction(onView || onTap),
      show: true,
    },
    {
      label: 'Edit',
      icon: <Edit2 className="w-4 h-4" />,
      onClick: () => handleMenuAction(onEdit!),
      show: canEdit && !!onEdit,
    },
    {
      label: 'Duplicate',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => handleMenuAction(onDuplicate!),
      show: !!onDuplicate,
    },
    {
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => handleMenuAction(onDelete!),
      variant: 'danger',
      show: canDelete && !!onDelete,
    },
  ];

  const visibleMenuItems = menuItems.filter(item => item.show);

  return (
    <>
      <div
        className={`relative ${className}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        {children}
      </div>

      {/* Action Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div
            className="fixed z-50 bg-[#1F2937] border border-[#374151] rounded-xl shadow-2xl overflow-hidden"
            style={{
              left: `${menuPosition.x}px`,
              top: `${menuPosition.y}px`,
              transform: 'translate(-50%, -100%) translateY(-8px)',
              minWidth: '160px',
            }}
          >
            {visibleMenuItems.map((item, idx) => (
              <button
                key={idx}
                onClick={item.onClick}
                className={`w-full px-4 py-3 flex items-center gap-3 ${
                  item.variant === 'danger'
                    ? 'text-[#EF4444] hover:bg-[#EF4444]/10'
                    : 'text-white hover:bg-[#374151]'
                } transition-colors border-b border-[#374151] last:border-0 active:scale-95`}
              >
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
