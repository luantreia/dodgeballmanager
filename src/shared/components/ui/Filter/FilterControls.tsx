// src/components/ui/Filter/FilterControls.tsx
import type { ChangeEvent, ReactNode } from 'react';
import { Card, Select, Button } from '../index';
import type { SelectOption } from '../Select/Select';

type FilterValue = string | number | readonly string[];

export interface FilterDefinition {
  key: string;
  label?: ReactNode;
  value?: FilterValue;
  options: SelectOption[];
  placeholder?: string;
}

export interface FilterControlsProps {
  filters?: FilterDefinition[];
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  className?: string;
}

/**
 * Componente FilterControls para controles de filtrado reutilizables
 */
const FilterControls = ({
  filters = [],
  onFilterChange,
  onClearFilters,
  className = ''
}: FilterControlsProps) => {
  const cardClasses = ['mb-6', className].filter(Boolean).join(' ');

  const handleChange = (key: string) => (event: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange(key, event.target.value);
  };

  return (
    <Card className={cardClasses}>
      <div className="flex flex-wrap gap-4 items-end">
        {filters.map((filter) => (
          <div key={filter.key} className="flex-1 min-w-[200px]">
            <Select
              label={filter.label}
              value={filter.value}
              onChange={handleChange(filter.key)}
              options={filter.options}
              placeholder={filter.placeholder}
            />
          </div>
        ))}

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default FilterControls;
