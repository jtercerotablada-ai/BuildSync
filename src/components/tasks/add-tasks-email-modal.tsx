"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, X, Copy, Check } from "lucide-react";

interface AddTasksEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTasksEmailModal({ open, onOpenChange }: AddTasksEmailModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && !email) {
      setLoading(true);
      fetch("/api/my-tasks/inbound-email")
        .then((res) => res.json())
        .then((data) => {
          if (data.email) setEmail(data.email);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, email]);

  function handleCopy() {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-w-[92vw] p-0 rounded-xl border-0 shadow-[0_12px_40px_rgba(0,0,0,0.22)] gap-0 overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">Agregar tareas por email</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-[22px] py-[18px]">
          <h2 className="text-[16px] font-semibold text-gray-900">Agregar tareas por email</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] pb-[22px] space-y-5">
          <p className="text-[14px] text-gray-600 leading-relaxed">
            Puedes agregar una tarea a esta lista enviando un email a:
          </p>

          {/* Email pill */}
          <button
            onClick={handleCopy}
            className="group relative w-full h-14 flex items-center justify-center bg-[#f3f4f6] rounded-lg hover:bg-[#ebedf0] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            {loading ? (
              <span className="text-[14px] text-gray-400">Cargando...</span>
            ) : (
              <>
                <span className="text-[18px] font-medium text-gray-800 select-all">
                  {email}
                </span>
                <span className="absolute right-4 flex items-center gap-1.5 text-[12px] text-gray-400 group-hover:text-gray-600 transition-colors">
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-green-600">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </span>
              </>
            )}
          </button>

          {/* Instructions */}
          <ul className="space-y-2.5 pl-1">
            {[
              "El asunto se convierte en el nombre de la tarea",
              "El cuerpo del email se convierte en la descripción de la tarea",
              "Los archivos adjuntos se agregan a la tarea",
              "Puedes poner en CC a compañeros de equipo para agregarlos como colaboradores",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-gray-600 leading-relaxed">
                <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-[3px]" />
                {item}
              </li>
            ))}
          </ul>

          {/* Learn more link */}
          <div>
            <a
              href="#"
              className="text-[13px] text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Más información
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
