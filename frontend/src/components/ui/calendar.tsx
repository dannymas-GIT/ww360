'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CalendarProps {
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[] | { from: Date; to: Date };
  onSelect?: (date: Date | Date[] | { from: Date; to: Date } | undefined) => void;
  className?: string;
  initialFocus?: boolean;
  disabled?: (date: Date) => boolean;
}

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ className, mode = 'single', selected, onSelect, initialFocus: _initialFocus, disabled, ...props }, ref) => {
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    const daysInMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate();
    const firstDayOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    ).getDay();

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const previousMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const isSelected = (date: Date) => {
      if (!selected) return false;

      if (mode === 'single' && selected instanceof Date) {
        return date.toDateString() === selected.toDateString();
      }

      return false;
    };

    const handleDateClick = (date: Date) => {
      if (disabled?.(date)) return;

      if (mode === 'single') {
        onSelect?.(date);
      }
    };

    const renderCalendarDays = () => {
      const days = [];

      // Empty cells for days before the first day of the month
      for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className="p-2"></div>);
      }

      // Days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const isDisabled = disabled?.(date);
        const isDateSelected = isSelected(date);

        days.push(
          <button
            key={day}
            onClick={() => handleDateClick(date)}
            disabled={isDisabled}
            className={cn(
              'p-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground',
              'focus:bg-accent focus:text-accent-foreground focus:outline-none',
              isDateSelected &&
                'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              isDisabled &&
                'text-muted-foreground opacity-50 cursor-not-allowed hover:bg-transparent'
            )}
          >
            {day}
          </button>
        );
      }

      return days;
    };

    return (
      <div ref={ref} className={cn('p-3', className)} {...props}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={previousMonth} className="h-7 w-7 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-sm font-medium">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>

          <Button variant="outline" size="sm" onClick={nextMonth} className="h-7 w-7 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div key={day} className="p-2 text-xs font-medium text-muted-foreground text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">{renderCalendarDays()}</div>
      </div>
    );
  }
);

Calendar.displayName = 'Calendar';

export { Calendar };
