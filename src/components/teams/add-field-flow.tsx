"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Plus,
  X,
  Settings,
  Circle,
  CheckSquare,
  Calendar,
  User,
  Link2,
  Type,
  Hash,
  CheckCircle,
  FolderKanban,
  Briefcase,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldMembersModal } from "./field-members-modal";

const fieldTypes = [
  { id: "single_select", label: "Single select", icon: Circle, placeholder: "Priority, stage, status..." },
  { id: "multi_select", label: "Multi select", icon: CheckSquare, placeholder: "Priority, stage, status..." },
  { id: "date", label: "Date", icon: Calendar, placeholder: "Publish date, estimated date..." },
  { id: "people", label: "People", icon: User, placeholder: "Designer, approver, recommended by..." },
  { id: "reference", label: "Reference", icon: Link2, placeholder: "Related work, backup work..." },
  { id: "text", label: "Text", icon: Type, placeholder: "Phone number, address..." },
  { id: "number", label: "Number", icon: Hash, placeholder: "Hours, cost, quantity..." },
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

const referenceSourceOptions = [
  { id: "tasks", label: "Tasks", icon: CheckCircle },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "portfolios", label: "Portfolios", icon: Briefcase },
  { id: "goals", label: "Goals", icon: Target },
];

const numberFormats = [
  { id: "number", label: "Number", example: "1,000" },
  { id: "currency", label: "Currency", example: "$1,000" },
  { id: "percentage", label: "Percentage", example: "100%" },
];

interface AddFieldFlowProps {
  onCreateField: (field: {
    title: string;
    type: string;
    description?: string;
    options?: Array<{ id: string; name: string; color: string }>;
    referenceSource?: string;
    numberFormat?: string;
    decimals?: number;
  }) => void;
  organizationName?: string;
}

export function AddFieldFlow({
  onCreateField,
  organizationName = "your workspace",
}: AddFieldFlowProps) {
  // STEP 1: Popover
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [fieldNameInPopover, setFieldNameInPopover] = useState("");

  // STEP 2: Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [title, setTitle] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState("");

  // For Single/Multi select
  const [options, setOptions] = useState([
    { id: "1", name: "", color: defaultColors[0] },
    { id: "2", name: "", color: defaultColors[1] },
  ]);

  // For Reference
  const [referenceSource, setReferenceSource] = useState<string | null>(null);

  // For Number
  const [numberFormat, setNumberFormat] = useState("number");
  const [decimals, setDecimals] = useState("1");

  // For Field Members Modal
  const [showMembersModal, setShowMembersModal] = useState(false);

  const currentFieldType = fieldTypes.find((t) => t.id === selectedType);
  const isSelectType = selectedType === "single_select" || selectedType === "multi_select";
  const isReferenceType = selectedType === "reference";
  const isNumberType = selectedType === "number";

  // Select type in popover
  const handleSelectType = (typeId: string) => {
    setSelectedType(typeId);
    setTitle(fieldNameInPopover);
    setPopoverOpen(false);
    setModalOpen(true);
    setFieldNameInPopover("");
  };

  // Options for Select types
  const handleAddOption = () => {
    const nextColorIndex = options.length % defaultColors.length;
    setOptions([
      ...options,
      { id: Date.now().toString(), name: "", color: defaultColors[nextColorIndex] },
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

  // Create field
  const handleCreate = () => {
    if (!title.trim()) return;

    onCreateField({
      title: title.trim(),
      type: selectedType,
      description: description.trim() || undefined,
      options: isSelectType ? options.filter((opt) => opt.name.trim()) : undefined,
      referenceSource: isReferenceType ? referenceSource || undefined : undefined,
      numberFormat: isNumberType ? numberFormat : undefined,
      decimals: isNumberType ? parseInt(decimals) : undefined,
    });
    resetModal();
  };

  // Reset
  const resetModal = () => {
    setModalOpen(false);
    setSelectedType("");
    setTitle("");
    setDescription("");
    setShowDescription(false);
    setOptions([
      { id: "1", name: "", color: defaultColors[0] },
      { id: "2", name: "", color: defaultColors[1] },
    ]);
    setReferenceSource(null);
    setNumberFormat("number");
    setDecimals("1");
  };

  // Calculate example for Number
  const getNumberExample = () => {
    const dec = parseInt(decimals);
    const decimalPart = dec > 0 ? "." + "0".repeat(dec) : "";
    if (numberFormat === "currency") return `$1,000${decimalPart}`;
    if (numberFormat === "percentage") return `100${decimalPart}%`;
    return `1,000${decimalPart}`;
  };

  return (
    <>
      {/* ========== STEP 1: POPOVER ========== */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button className="p-1 hover:bg-gray-200 rounded">
            <Plus className="h-4 w-4 text-gray-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="end" sideOffset={8}>
          <div className="p-3 border-b">
            <Input
              value={fieldNameInPopover}
              onChange={(e) => setFieldNameInPopover(e.target.value)}
              placeholder="New field"
              className="border-2 border-black focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="p-2">
            <p className="text-xs text-gray-500 px-2 py-1">Field types</p>
            <div className="mt-1">
              {fieldTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type.id)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-100 text-left"
                  >
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* ========== STEP 2: MODAL ========== */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && resetModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>Add field</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowMembersModal(true)}
            >
              <Settings className="h-4 w-4" />
              Manage access
            </Button>
          </DialogHeader>

          {/* Visibility info */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-600">
              This field is visible to everyone in {organizationName}.
            </span>
            <Button
              variant="link"
              size="sm"
              className="text-black h-auto p-0"
              onClick={() => setShowMembersModal(true)}
            >
              Change access
            </Button>
          </div>

          {/* Send feedback link (only for Reference) */}
          {isReferenceType && (
            <button className="text-sm text-black hover:underline text-left">
              Send feedback
            </button>
          )}

          <div className="space-y-4 py-2">
            {/* Title and Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">
                  Field title <span className="text-black">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={currentFieldType?.placeholder || ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Field type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
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

            {/* Add description */}
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

            {/* ===== SINGLE/MULTI SELECT: Options ===== */}
            {isSelectType && (
              <div>
                <Label className="text-sm">
                  Options <span className="text-black">*</span>
                </Label>
                <div className="mt-2 space-y-2">
                  {options.map((option) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: option.color }}
                      />
                      <Input
                        value={option.name}
                        onChange={(e) => handleOptionChange(option.id, e.target.value)}
                        placeholder="Enter option name"
                        className="flex-1"
                      />
                      <button
                        onClick={() => handleRemoveOption(option.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
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

            {/* ===== REFERENCE: Source ===== */}
            {isReferenceType && (
              <>
                <div>
                  <Label className="text-sm">
                    Source <span className="text-black">*</span>
                  </Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {referenceSourceOptions.map((source) => {
                      const Icon = source.icon;
                      const isSelected = referenceSource === source.id;
                      return (
                        <button
                          key={source.id}
                          onClick={() => setReferenceSource(source.id)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 border rounded-lg hover:border-gray-400 transition-colors",
                            isSelected && "border-black bg-white"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-5 w-5",
                              isSelected ? "text-black" : "text-gray-500"
                            )}
                          />
                          <span className="text-xs">{source.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">
                    Filters for reference list
                  </Label>
                  <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mt-2">
                    <Plus className="h-4 w-4" />
                    Add filter
                  </button>
                </div>
              </>
            )}

            {/* ===== NUMBER: Format and Decimals ===== */}
            {isNumberType && (
              <>
                <div>
                  <Label className="text-sm">Format</Label>
                  <Select value={numberFormat} onValueChange={setNumberFormat}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {numberFormats.map((format) => (
                        <SelectItem key={format.id} value={format.id}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Decimals</Label>
                    <Select value={decimals} onValueChange={setDecimals}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: "0", label: "0" },
                          { value: "1", label: "0.0" },
                          { value: "2", label: "0.00" },
                          { value: "3", label: "0.000" },
                          { value: "4", label: "0.0000" },
                        ].map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Example</Label>
                    <p className="mt-2 text-lg font-medium">{getNumberExample()}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={resetModal}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || (isReferenceType && !referenceSource)}
              className="bg-black hover:bg-black"
            >
              Create field
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== FIELD MEMBERS MODAL ========== */}
      <FieldMembersModal
        open={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        onBack={() => setShowMembersModal(false)}
        organizationName={organizationName}
        members={[
          {
            id: "1",
            name: "Item administrators (Team)",
            type: "group",
            role: "admin",
          },
          {
            id: "2",
            name: "Guests",
            type: "group",
            role: "user",
          },
        ]}
      />
    </>
  );
}
