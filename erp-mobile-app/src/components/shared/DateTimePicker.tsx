import { useState, useEffect } from 'react';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  showTime?: boolean;
  label?: string;
}

export function DateTimePicker({ value, onChange, onClose, showTime = false, label = 'DATE' }: DateTimePickerProps) {
  const initialDate = value ? new Date(value) : new Date();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 3 + i);
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const [scrollMonth, setScrollMonth] = useState(initialDate.getMonth());
  const [scrollDay, setScrollDay] = useState(initialDate.getDate());
  const [scrollYear, setScrollYear] = useState(initialDate.getFullYear());
  const [scrollHour, setScrollHour] = useState(initialDate.getHours() % 12 || 12);
  const [scrollMinute, setScrollMinute] = useState(initialDate.getMinutes());
  const [scrollPeriod, setScrollPeriod] = useState<'AM' | 'PM'>(initialDate.getHours() >= 12 ? 'PM' : 'AM');

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const maxDays = getDaysInMonth(scrollMonth, scrollYear);

  useEffect(() => {
    if (scrollDay > maxDays) {
      setScrollDay(maxDays);
    }
  }, [scrollMonth, scrollYear, maxDays]);

  const handleConfirm = () => {
    let hour = scrollHour;
    if (showTime) {
      if (scrollPeriod === 'PM' && scrollHour !== 12) {
        hour = scrollHour + 12;
      } else if (scrollPeriod === 'AM' && scrollHour === 12) {
        hour = 0;
      }
    } else {
      hour = 0;
    }

    const newDate = new Date(scrollYear, scrollMonth, scrollDay, hour, scrollMinute);
    const formattedDate = newDate.toISOString().split('T')[0];
    onChange(formattedDate);
    onClose();
  };

  const handleNow = () => {
    const now = new Date();
    setScrollMonth(now.getMonth());
    setScrollDay(now.getDate());
    setScrollYear(now.getFullYear());
    if (showTime) {
      setScrollHour(now.getHours() % 12 || 12);
      setScrollMinute(now.getMinutes());
      setScrollPeriod(now.getHours() >= 12 ? 'PM' : 'AM');
    }
  };

  const WheelPicker = <T,>({
    items,
    value,
    onChange,
    renderItem
  }: {
    items: T[];
    value: T;
    onChange: (v: T) => void;
    renderItem?: (item: T) => string | number;
  }) => {
    const selectedIndex = items.indexOf(value);

    return (
      <div className="flex-1 relative h-[180px] overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-full h-[44px] bg-[#8B5CF6]/20 border-y-2 border-[#8B5CF6]/40 rounded-lg"></div>
        </div>
        <div className="overflow-y-auto h-full scrollbar-hide snap-y snap-mandatory">
          <div className="py-[68px]">
            {items.map((item, index) => {
              const isSelected = index === selectedIndex;
              const distance = Math.abs(index - selectedIndex);
              const opacity = Math.max(0.2, 1 - distance * 0.35);

              return (
                <button
                  key={index}
                  onClick={() => onChange(item)}
                  className="w-full h-[44px] flex items-center justify-center snap-center transition-all"
                  style={{ opacity }}
                >
                  <span className={`text-base transition-all ${
                    isSelected
                      ? 'font-bold text-white text-lg scale-110'
                      : 'font-medium text-[#9CA3AF]'
                  }`}>
                    {renderItem ? renderItem(item) : String(item)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-full sm:max-w-[360px]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-t-2xl px-4 py-4 border-b border-[#374151]">
          <p className="text-center text-sm font-bold text-white tracking-wider">{label}</p>
        </div>

        <div className="bg-[#1F2937] rounded-b-2xl overflow-hidden border-2 border-[#374151]">
          <div className="flex items-center h-[180px] px-2 bg-[#111827]">
            <WheelPicker
              items={Array.from({ length: 12 }, (_, i) => i)}
              value={scrollMonth}
              onChange={setScrollMonth}
              renderItem={(month) => months[month as number]}
            />
            <WheelPicker
              items={Array.from({ length: maxDays }, (_, i) => i + 1)}
              value={scrollDay}
              onChange={setScrollDay}
            />
            <WheelPicker
              items={years}
              value={scrollYear}
              onChange={setScrollYear}
            />

            {showTime && (
              <>
                <WheelPicker
                  items={hours}
                  value={scrollHour}
                  onChange={setScrollHour}
                  renderItem={(h) => String(h).padStart(2, '0')}
                />
                <WheelPicker
                  items={minutes}
                  value={scrollMinute}
                  onChange={setScrollMinute}
                  renderItem={(m) => String(m).padStart(2, '0')}
                />
                <WheelPicker
                  items={['AM', 'PM']}
                  value={scrollPeriod}
                  onChange={setScrollPeriod}
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-[#1F2937] border-t border-[#374151]">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleNow}
              className="px-5 py-2.5 text-sm font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/10 rounded-lg transition-colors"
            >
              Now
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-lg hover:shadow-lg hover:shadow-[#8B5CF6]/30 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DateInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  showTime?: boolean;
  pickerLabel?: string;
}

export function DateInputField({ label, value, onChange, required = false, showTime = false, pickerLabel = 'DATE' }: DateInputFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-[#D1D5DB] mb-2">
          {label} {required && '*'}
        </label>
        <button
          onClick={() => setShowPicker(true)}
          className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-left focus:outline-none focus:border-[#3B82F6] hover:border-[#6B7280] transition-colors"
        >
          <span className={value ? 'text-white' : 'text-[#9CA3AF]'}>
            {formatDisplayDate(value)}
          </span>
        </button>
      </div>

      {showPicker && (
        <DateTimePicker
          value={value}
          onChange={onChange}
          onClose={() => setShowPicker(false)}
          showTime={showTime}
          label={pickerLabel}
        />
      )}
    </>
  );
}
