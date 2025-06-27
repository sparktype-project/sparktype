// src/features/editor/components/forms/ContentTypeSelector.tsx
'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from "@/core/components/ui/label";
import type { LayoutManifest } from '@/core/types';

interface ContentTypeSelectorProps {
  availableTypes: LayoutManifest[];
  selectedType: string;
  onChange: (newTypeId: string) => void;
}

export default function ContentTypeSelector({ availableTypes, selectedType, onChange }: ContentTypeSelectorProps) {
  const selectedTypeManifest = availableTypes.find(type => type.id === selectedType);

  return (
    <div className="space-y-2">
      <Label htmlFor="content-type-select">Content Type</Label>
      <Select
        value={selectedType || ''}
        onValueChange={onChange}
      >
        <SelectTrigger id="content-type-select" className="w-full">
          <SelectValue placeholder="Select a content type..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {availableTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {selectedTypeManifest?.description && (
        <p className="text-xs text-muted-foreground pt-1">
          {selectedTypeManifest.description}
        </p>
      )}
    </div>
  );
}