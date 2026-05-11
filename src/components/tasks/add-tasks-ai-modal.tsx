"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, X, FileText, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeneratedTask {
  name: string;
  dueDate: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
}

interface AddTasksAIModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTasksCreated: () => void;
}

type ModalStep = "input" | "review" | "creating";

export function AddTasksAIModal({ open, onOpenChange, onTasksCreated }: AddTasksAIModalProps) {
  const [step, setStep] = useState<ModalStep>("input");
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [pastedText, setPastedText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasInput = inputMode === "paste" ? pastedText.trim().length > 0 : file !== null;

  function resetState() {
    setStep("input");
    setInputMode("upload");
    setPastedText("");
    setInstructions("");
    setFile(null);
    setFileContent("");
    setIsDragging(false);
    setIsGenerating(false);
    setGeneratedTasks([]);
    setSelectedTasks(new Set());
    setIsCreating(false);
    setCreatedCount(0);
    setError("");
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(resetState, 200);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }, []);

  function processFile(f: File) {
    const validTypes = [
      "text/plain", "text/markdown", "text/csv",
      "application/pdf", "image/png", "image/jpeg", "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const validExts = [".txt", ".md", ".csv", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx"];
    const ext = "." + f.name.split(".").pop()?.toLowerCase();

    if (!validTypes.includes(f.type) && !validExts.includes(ext)) {
      setError("Unsupported file type. Use txt, md, csv, pdf, docx, or image files.");
      return;
    }

    setFile(f);
    setError("");

    // Read text-based files
    if (f.type.startsWith("text/") || ext === ".md" || ext === ".csv") {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target?.result as string || "");
      };
      reader.readAsText(f);
    } else {
      // For non-text files, we'll send the filename as context
      setFileContent(`[File: ${f.name} (${f.type})]`);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  function removeFile() {
    setFile(null);
    setFileContent("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleContinue() {
    setError("");
    setIsGenerating(true);

    const text = inputMode === "paste" ? pastedText : fileContent;

    try {
      const res = await fetch("/api/ai/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, instructions: instructions.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate tasks");
      }

      const data = await res.json();
      if (!data.tasks || data.tasks.length === 0) {
        setError("No actionable tasks found in the provided content. Try adding more detail or adjusting your instructions.");
        setIsGenerating(false);
        return;
      }

      setGeneratedTasks(data.tasks);
      setSelectedTasks(new Set(data.tasks.map((_: GeneratedTask, i: number) => i)));
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleTask(index: number) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (selectedTasks.size === generatedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(generatedTasks.map((_, i) => i)));
    }
  }

  async function handleCreateTasks() {
    const tasksToCreate = generatedTasks.filter((_, i) => selectedTasks.has(i));
    if (tasksToCreate.length === 0) return;

    setStep("creating");
    setIsCreating(true);
    setCreatedCount(0);

    let successCount = 0;
    for (const task of tasksToCreate) {
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: task.name,
            dueDate: task.dueDate,
            priority: task.priority !== "NONE" ? task.priority : undefined,
          }),
        });
        if (res.ok) successCount++;
      } catch {
        // continue with remaining tasks
      }
      setCreatedCount((prev) => prev + 1);
    }

    setIsCreating(false);

    if (successCount > 0) {
      onTasksCreated();
      handleClose();
    } else {
      setError("Failed to create tasks. Please try again.");
      setStep("review");
    }
  }

  const selectedCount = selectedTasks.size;
  const totalTasks = generatedTasks.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[820px] p-0 rounded-xl border-0 shadow-[0_16px_48px_rgba(0,0,0,0.16)] gap-0 overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">Add tasks with AI</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold text-gray-900">
              {step === "input" && "Add tasks with AI"}
              {step === "review" && `Review tasks (${selectedCount}/${totalTasks} selected)`}
              {step === "creating" && "Creating tasks..."}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {step === "input" && (
          <div className="px-6 py-5 space-y-5">
            <p className="text-[13px] text-gray-500 leading-relaxed">
              Upload a file or paste text with tasks. AI will extract the actionable items and create tasks for you.
            </p>

            {/* Upload / Paste toggle */}
            {inputMode === "upload" ? (
              <>
                {/* Drag & Drop Zone */}
                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 py-10 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                      isDragging
                        ? "border-black bg-gray-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                    )}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-medium text-gray-700">
                        Drop a file here, or <span className="text-black underline underline-offset-2">browse</span>
                      </p>
                      <p className="text-[12px] text-gray-400 mt-1">
                        Supports txt, md, csv, pdf, docx, and images
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-[11px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(); }}
                      className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.csv,.pdf,.docx,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => setInputMode("paste")}
                  className="text-[13px] text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
                >
                  Paste text instead
                </button>
              </>
            ) : (
              <>
                {/* Paste Text Area */}
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste your meeting notes, email, project summary, or any text containing tasks..."
                  className="w-full h-40 px-4 py-3 text-[13px] text-gray-800 placeholder:text-gray-400 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-colors"
                />
                <button
                  onClick={() => setInputMode("upload")}
                  className="text-[13px] text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
                >
                  Upload a file instead
                </button>
              </>
            )}

            {/* AI Instructions */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-gray-700">
                Instructions for AI <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., Focus only on high priority items, set all due dates for next week..."
                className="w-full h-20 px-4 py-3 text-[13px] text-gray-800 placeholder:text-gray-400 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-100 border border-red-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-black">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-gray-500">
                Select the tasks you want to create:
              </p>
              <button
                onClick={toggleAll}
                className="text-[12px] text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                {selectedTasks.size === totalTasks ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto space-y-1 -mx-1 px-1">
              {generatedTasks.map((task, index) => (
                <label
                  key={index}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                    selectedTasks.has(index) ? "bg-gray-50" : "hover:bg-gray-50/50"
                  )}
                >
                  <div className="pt-0.5">
                    <div
                      className={cn(
                        "flex items-center justify-center w-4 h-4 rounded border transition-colors",
                        selectedTasks.has(index)
                          ? "bg-black border-black"
                          : "border-gray-300"
                      )}
                    >
                      {selectedTasks.has(index) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => toggleTask(index)}>
                    <p className="text-[13px] font-medium text-gray-800">{task.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {task.dueDate && (
                        <span className="text-[11px] text-gray-400">
                          Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {task.priority !== "NONE" && (
                        <span className={cn(
                          "text-[11px] font-medium",
                          task.priority === "HIGH" ? "text-black" :
                          task.priority === "MEDIUM" ? "text-[#a8893a]" : "text-[#a8893a]"
                        )}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-100 border border-red-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-black">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === "creating" && (
          <div className="px-6 py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            <p className="text-[14px] text-gray-600">
              Creating {createdCount} of {selectedCount} tasks...
            </p>
          </div>
        )}

        {/* Footer */}
        {step !== "creating" && (
          <div className="flex items-center justify-between px-6 h-14 border-t border-gray-100 bg-gray-50/50">
            <div>
              {step === "review" && (
                <button
                  onClick={() => { setStep("input"); setError(""); }}
                  className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Back
                </button>
              )}
            </div>
            <Button
              onClick={step === "input" ? handleContinue : handleCreateTasks}
              disabled={step === "input" ? (!hasInput || isGenerating) : selectedCount === 0}
              className="h-9 px-5 bg-black text-white hover:bg-gray-800 rounded-lg text-[13px] font-medium disabled:opacity-40"
            >
              {step === "input" && isGenerating && (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Analyzing...
                </>
              )}
              {step === "input" && !isGenerating && "Continue"}
              {step === "review" && `Create ${selectedCount} task${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
