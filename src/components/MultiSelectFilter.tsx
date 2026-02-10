import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  icon?: string; // URL for avatar/thumbnail
  sublabel?: string;
  live?: boolean;
}

interface MultiSelectFilterProps {
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  icon?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  isSearching?: boolean;
  maxDisplay?: number;
  className?: string;
  allValue?: string; // special "all" value that clears other selections
}

const MultiSelectFilter = ({
  options,
  selected,
  onChange,
  placeholder,
  icon,
  searchable = false,
  searchPlaceholder = "Buscar...",
  onSearch,
  isSearching = false,
  maxDisplay = 2,
  className,
  allValue = "all",
}: MultiSelectFilterProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleToggle = (value: string) => {
    if (value === allValue) {
      onChange([]);
      return;
    }
    
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    
    onChange(newSelected);
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== value));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (onSearch) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => onSearch(value), 300);
    }
  };

  const filteredOptions = searchable && !onSearch
    ? options.filter(o => 
        o.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const isAllSelected = selected.length === 0;

  const getSelectedLabels = () => {
    if (isAllSelected) return placeholder;
    const labels = selected
      .map(v => options.find(o => o.value === v)?.label || v)
      .slice(0, maxDisplay);
    const remaining = selected.length - maxDisplay;
    return labels.join(", ") + (remaining > 0 ? ` +${remaining}` : "");
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-w-[120px] max-w-[280px] justify-between gap-1 text-xs font-normal"
          >
            <span className="truncate">
              {isAllSelected ? placeholder : getSelectedLabels()}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-2" align="start">
          {searchable && (
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          )}
          <div className="max-h-[250px] overflow-y-auto space-y-0.5">
            {/* "All" option */}
            <button
              onClick={() => handleToggle(allValue)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors text-left",
                isAllSelected && "bg-accent"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                isAllSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
              )}>
                {isAllSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <span>{placeholder}</span>
            </button>
            
            {filteredOptions
              .filter(o => o.value !== allValue)
              .map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleToggle(option.value)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors text-left",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    {option.icon && (
                      <img src={option.icon} alt="" className="w-5 h-5 rounded-full shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{option.label}</span>
                        {option.live && (
                          <span className="text-[9px] bg-destructive text-destructive-foreground px-1 rounded">LIVE</span>
                        )}
                      </div>
                      {option.sublabel && (
                        <span className="text-muted-foreground text-[10px] truncate block">{option.sublabel}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            {isSearching && (
              <div className="text-center py-2 text-xs text-muted-foreground">Buscando...</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Active filter badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.slice(0, 3).map(value => {
            const option = options.find(o => o.value === value);
            return (
              <Badge key={value} variant="secondary" className="text-[10px] h-6 gap-1 px-1.5">
                {option?.icon && <img src={option.icon} alt="" className="w-3.5 h-3.5 rounded-full" />}
                <span className="max-w-[60px] truncate">{option?.label || value}</span>
                <button onClick={(e) => handleRemove(value, e)} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
          {selected.length > 3 && (
            <Badge variant="outline" className="text-[10px] h-6 px-1.5">
              +{selected.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;
