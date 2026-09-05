import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { useWells } from '@/hooks/useWells';

interface Well {
  id: number;
  well_number: string;
  name?: string;
}

interface WellMultiSelectProps {
  selectedWells: number[];
  onSelectionChange: (selectedWells: number[]) => void;
  placeholder?: string;
  className?: string;
}

export const WellMultiSelect: React.FC<WellMultiSelectProps> = ({
  selectedWells,
  onSelectionChange,
  placeholder = 'Search wells by number or name...',
  className = '',
}) => {
  const { data: wells = [] } = useWells();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter wells based on search term; always include selected wells so they can be unchecked
  const filteredWells = useMemo(() => {
    const matchesSearch = (well: Well) =>
      !searchTerm ||
      well.well_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (well.name && well.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const selected = wells.filter((w: Well) => selectedWells.includes(w.id));
    const unselected = wells.filter(
      (w: Well) => !selectedWells.includes(w.id) && matchesSearch(w)
    );
    return [...selected, ...unselected];
  }, [wells, searchTerm, selectedWells]);

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
        />
      </div>

      {/* Wells list */}
      <div className="border rounded-md p-2 min-h-[80px] max-h-[200px] overflow-y-auto">
        {wells.length === 0 ? (
          <div className="text-sm text-muted-foreground">No wells available</div>
        ) : filteredWells.length === 0 ? (
          <div className="text-sm text-muted-foreground">No wells match "{searchTerm}"</div>
        ) : (
          <div className="space-y-1">
            {filteredWells.map((well: Well) => (
              <div
                key={well.id}
                className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded"
              >
                <Checkbox
                  id={`well-${well.id}`}
                  checked={selectedWells.includes(well.id)}
                  onChange={e => {
                    const checked = e.target.checked;
                    const newSelection = checked
                      ? [...selectedWells, well.id]
                      : selectedWells.filter((id: number) => id !== well.id);
                    onSelectionChange(newSelection);
                  }}
                />
                <Label htmlFor={`well-${well.id}`} className="text-sm cursor-pointer flex-1">
                  {well.well_number} {well.name && `- ${well.name}`}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected wells display */}
      {selectedWells.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedWells.length} well{selectedWells.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};
