"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

export interface AdvancedSearchCriteria {
  words: string;
  type: "task" | "milestone" | "approval";
  includeSubtasks: boolean;
  includeMilestones: boolean;
  includeApprovals: boolean;
  location: string;
  status: "any" | "incomplete" | "complete";
  assignees: string[];
  dueDate: "any" | "today" | "this_week" | "next_week" | "overdue" | "no_date";
  collaborators: string;
}

interface AdvancedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (criteria: AdvancedSearchCriteria) => void;
}

// ─── Defaults ────────────────────────────────────────────

function getDefaults(): AdvancedSearchCriteria {
  return {
    words: "",
    type: "task",
    includeSubtasks: true,
    includeMilestones: true,
    includeApprovals: true,
    location: "anywhere",
    status: "any",
    assignees: [],
    dueDate: "any",
    collaborators: "",
  };
}

// ─── Component ───────────────────────────────────────────

export function AdvancedSearchModal({
  open,
  onOpenChange,
  onSearch,
}: AdvancedSearchModalProps) {
  const [criteria, setCriteria] = useState<AdvancedSearchCriteria>(getDefaults);

  function handleReset() {
    setCriteria(getDefaults());
  }

  function handleSearch() {
    onSearch(criteria);
    onOpenChange(false);
  }

  function update(partial: Partial<AdvancedSearchCriteria>) {
    setCriteria((prev) => ({ ...prev, ...partial }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] p-0 gap-0 rounded-xl"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <DialogHeader className="p-0">
            <DialogTitle className="text-[16px] font-semibold text-gray-900">
              Búsqueda avanzada
            </DialogTitle>
          </DialogHeader>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Contiene las palabras */}
          <FieldRow label="Contiene las palabras">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={criteria.words}
                onChange={(e) => update({ words: e.target.value })}
                placeholder="Escribe palabras clave..."
                className="flex-1 h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
              />
              {criteria.words && (
                <button
                  onClick={() => update({ words: "" })}
                  className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                >
                  Borrar
                </button>
              )}
            </div>
          </FieldRow>

          {/* Tipo */}
          <FieldRow label="Tipo">
            <Select
              value={criteria.type}
              onValueChange={(v) =>
                update({ type: v as AdvancedSearchCriteria["type"] })
              }
            >
              <SelectTrigger className="h-9 text-[13px] w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Tarea</SelectItem>
                <SelectItem value="milestone">Hito</SelectItem>
                <SelectItem value="approval">Aprobación</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Incluir */}
          <FieldRow label="Incluir">
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <Checkbox
                  checked={criteria.includeSubtasks}
                  onCheckedChange={(v) =>
                    update({ includeSubtasks: v === true })
                  }
                />
                Subtareas
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <Checkbox
                  checked={criteria.includeMilestones}
                  onCheckedChange={(v) =>
                    update({ includeMilestones: v === true })
                  }
                />
                Hitos
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <Checkbox
                  checked={criteria.includeApprovals}
                  onCheckedChange={(v) =>
                    update({ includeApprovals: v === true })
                  }
                />
                Aprobaciones
              </label>
            </div>
          </FieldRow>

          {/* Ubicado */}
          <FieldRow label="Ubicado">
            <Select
              value={criteria.location}
              onValueChange={(v) => update({ location: v })}
            >
              <SelectTrigger className="h-9 text-[13px] w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anywhere">En cualquier lugar</SelectItem>
                <SelectItem value="my_tasks">Mis tareas</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Estado */}
          <FieldRow label="Estado">
            <Select
              value={criteria.status}
              onValueChange={(v) =>
                update({ status: v as AdvancedSearchCriteria["status"] })
              }
            >
              <SelectTrigger className="h-9 text-[13px] w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="incomplete">Sin finalizar</SelectItem>
                <SelectItem value="complete">Finalizada</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Asignada a */}
          <FieldRow label="Asignada a">
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
              {criteria.assignees.map((name, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-[12px] text-gray-700 rounded-md"
                >
                  {name}
                  <button
                    onClick={() =>
                      update({
                        assignees: criteria.assignees.filter(
                          (_, i) => i !== idx
                        ),
                      })
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={
                  criteria.assignees.length === 0 ? "Buscar personas..." : ""
                }
                className="flex-1 min-w-[80px] text-[13px] outline-none bg-transparent placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (e.target as HTMLInputElement).value.trim()
                  ) {
                    update({
                      assignees: [
                        ...criteria.assignees,
                        (e.target as HTMLInputElement).value.trim(),
                      ],
                    });
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
          </FieldRow>

          {/* Fecha de entrega */}
          <FieldRow label="Fecha de entrega">
            <Select
              value={criteria.dueDate}
              onValueChange={(v) =>
                update({ dueDate: v as AdvancedSearchCriteria["dueDate"] })
              }
            >
              <SelectTrigger className="h-9 text-[13px] w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="this_week">Esta semana</SelectItem>
                <SelectItem value="next_week">Próxima semana</SelectItem>
                <SelectItem value="overdue">Atrasada</SelectItem>
                <SelectItem value="no_date">Sin fecha</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Colaboradores */}
          <FieldRow label="Colaboradores">
            <input
              type="text"
              value={criteria.collaborators}
              onChange={(e) => update({ collaborators: e.target.value })}
              placeholder="Buscar colaboradores..."
              className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
            />
          </FieldRow>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <button className="text-[13px] text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Agregar filtro
            </button>
            <button
              onClick={handleReset}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Restablecer los filtros
            </button>
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 px-4 h-9 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Buscar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
      <label className="text-[13px] text-gray-500 font-medium pt-2">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}
