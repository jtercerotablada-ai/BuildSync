"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Plus,
  Settings,
  Circle,
  CheckSquare,
  Calendar,
  User,
  Link2,
  Type,
  Hash,
} from "lucide-react";

interface AddFieldModalProps {
  open: boolean;
  onClose: () => void;
  onCreateField: (field: {
    title: string;
    type: string;
    description?: string;
    options?: Array<{ id: string; name: string; color: string }>;
  }) => void;
  organizationName?: string;
}

const fieldTypes = [
  { id: "single_select", label: "Single select", icon: Circle },
  { id: "multi_select", label: "Multi select", icon: CheckSquare },
  { id: "date", label: "Date", icon: Calendar },
  { id: "people", label: "People", icon: User },
  { id: "reference", label: "Reference", icon: Link2 },
  { id: "text", label: "Text", icon: Type },
  { id: "number", label: "Number", icon: Hash },
];

const defaultColors = [
  "#22c55e", // green
  "#ef4444", // red
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export function AddFieldModal({
  open,
  onClose,
  onCreateField,
  organizationName = "your organization",
}: AddFieldModalProps) {
  const [title, setTitle] = useState("");
  const [fieldType, setFieldType] = useState("single_select");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [options, setOptions] = useState([
    { id: "1", name: "", color: defaultColors[0] },
    { id: "2", name: "", color: defaultColors[1] },
  ]);

  const isSelectType = fieldType === "single_select" || fieldType === "multi_select";

  const handleAddOption = () => {
    const nextColorIndex = options.length % defaultColors.length;
    setOptions([
      ...options,
      {
        id: Date.now().toString(),
        name: "",
        color: defaultColors[nextColorIndex],
      },
    ]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length > 1) {
      setOptions(options.filter((opt) => opt.id !== id));
    }
  };

  const handleOptionChange = (id: string, name: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, name } : opt)));
  };

  const resetForm = () => {
    setTitle("");
    setFieldType("single_select");
    setDescription("");
    setShowDescription(false);
    setOptions([
      { id: "1", name: "", color: defaultColors[0] },
      { id: "2", name: "", color: defaultColors[1] },
    ]);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    onCreateField({
      title: title.trim(),
      type: fieldType,
      description: description.trim() || undefined,
      options: isSelectType ? options.filter((opt) => opt.name.trim()) : undefined,
    });

    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <DialogTitle>Add field</DialogTitle>
          <Button variant="outline" size="sm" className="gap-2 h-8">
            <Settings className="h-4 w-4" />
            Manage access
          </Button>
        </DialogHeader>

        {/* Visibility info */}
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
          <span className="text-gray-600">
            This field is visible to everyone in {organizationName}.
          </span>
          <Button variant="link" size="sm" className="text-black h-auto p-0">
            Change access
          </Button>
        </div>

        <div className="space-y-4 py-2">
          {/* Title and Type row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <Label className="text-sm">
                Field title <span className="text-black">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Priority, stage, status..."
                className="mt-1"
              />
            </div>

            {/* Type */}
            <div>
              <Label className="text-sm">Field type</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-500" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Add description link */}
          {!showDescription ? (
            <button
              onClick={() => setShowDescription(true)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <Plus className="h-4 w-4" />
              Add description
            </button>
          ) : (
            <div>
              <Label className="text-sm">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this field..."
                className="mt-1"
              />
            </div>
          )}

          {/* Options section - only for select types */}
          {isSelectType && (
            <div>
              <Label className="text-sm">
                Options <span className="text-black">*</span>
              </Label>
              <div className="mt-2 space-y-2">
                {options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    {/* Color dot */}
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                    {/* Input */}
                    <Input
                      value={option.name}
                      onChange={(e) => handleOptionChange(option.id, e.target.value)}
                      placeholder="Enter option name"
                      className="flex-1"
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveOption(option.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Add option button */}
                <button
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mt-2"
                >
                  <Plus className="h-4 w-4" />
                  Add an option
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="bg-black hover:bg-black"
          >
            Create field
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
