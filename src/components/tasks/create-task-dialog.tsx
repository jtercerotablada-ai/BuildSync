"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toDateOnlyISO } from "@/lib/date-only";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  sectionId?: string;
  /** Create a milestone/approval instead of a plain task (Asana's
   *  "Add task ▾ → Milestone" split button in Timeline/Gantt). */
  defaultTaskType?: "TASK" | "MILESTONE" | "APPROVAL";
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  sectionId,
  defaultTaskType,
}: CreateTaskDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  // Every label follows the type being created: a milestone opened from
  // Overview > Milestones must not read "Task name" / "Create task".
  const noun =
    defaultTaskType === "MILESTONE"
      ? "Milestone"
      : defaultTaskType === "APPROVAL"
        ? "Approval"
        : "Task";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(`${noun} name is required`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          dueDate: dueDate ? toDateOnlyISO(dueDate) : undefined,
          projectId,
          sectionId,
          taskType: defaultTaskType,
        }),
      });

      if (!response.ok) {
        // Surface the server's reason (read-only access, bad date range,
        // missing section) instead of a generic failure.
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Failed to create ${noun.toLowerCase()}`);
      }

      toast.success(`${noun} created successfully`);
      onOpenChange(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to create ${noun.toLowerCase()}`
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setDueDate(undefined);
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {defaultTaskType === "MILESTONE"
                ? "Add milestone"
                : `Create new ${noun.toLowerCase()}`}
            </DialogTitle>
            <DialogDescription>
              {defaultTaskType === "MILESTONE"
                ? "Mark an important point in your project's schedule."
                : defaultTaskType === "APPROVAL"
                  ? "Ask for a sign-off on a piece of work."
                  : "Add a new task to track your work."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">{noun} name</Label>
              <Input
                id="task-name"
                placeholder={
                  defaultTaskType === "MILESTONE"
                    ? "What point are you marking?"
                    : "What needs to be done?"
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (optional)</Label>
              <Textarea
                id="task-description"
                placeholder="Add more details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : `Create ${noun.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
