import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAnalytes } from '@/services/readings';

interface ConstituentMultiSelectProps {
  selectedConstituents: string[];
  onSelectionChange: (selectedConstituents: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const ConstituentMultiSelect: React.FC<ConstituentMultiSelectProps> = ({
  selectedConstituents,
  onSelectionChange,
  placeholder = 'Search contaminants...',
  className = '',
  disabled = false,
}) => {
  const { data: constituents = [] } = useQuery({
    queryKey: ['analytes'],
    queryFn: getAnalytes,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Filter constituents based on search term; always include selected so they can be unchecked
  const filteredConstituents = useMemo(() => {
    const matchesSearch = (c: string) =>
      !searchTerm || c.toLowerCase().includes(searchTerm.toLowerCase());

    const selected = constituents.filter((c: string) => selectedConstituents.includes(c));
    const unselected = constituents.filter(
      (c: string) => !selectedConstituents.includes(c) && matchesSearch(c)
    );
    return [...selected, ...unselected];
  }, [constituents, searchTerm, selectedConstituents]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
          disabled={disabled}
        />
      </div>

      {/* Constituents list */}
      <div className="border rounded-md p-2 min-h-[80px] max-h-[200px] overflow-y-auto">
        {constituents.length === 0 ? (
          <div className="text-sm text-muted-foreground">No contaminants available</div>
        ) : filteredConstituents.length === 0 ? (
          <div className="text-sm text-muted-foreground">No contaminants match "{searchTerm}"</div>
        ) : (
          <div className="space-y-1">
            {filteredConstituents.map((constituent: string) => (
              <div
                key={constituent}
                className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded"
              >
                <Checkbox
                  id={`constituent-${constituent}`}
                  checked={selectedConstituents.includes(constituent)}
                  disabled={disabled}
                  onChange={e => {
                    if (disabled) return;
                    const checked = e.target.checked;
                    const newSelection = checked
                      ? [...selectedConstituents, constituent]
                      : selectedConstituents.filter((c: string) => c !== constituent);
                    onSelectionChange(newSelection);
                  }}
                />
                <Label
                  htmlFor={`constituent-${constituent}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {constituent}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected constituents display */}
      {selectedConstituents.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedConstituents.length} contaminant{selectedConstituents.length !== 1 ? 's' : ''}{' '}
          selected
        </div>
      )}
    </div>
  );
};
