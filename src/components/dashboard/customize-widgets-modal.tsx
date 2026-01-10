'use client';

import { useState } from 'react';
import {
  CheckSquare,
  FolderKanban,
  BarChart3,
  Target,
  MessageCircle,
  Briefcase,
  StickyNote,
  Users,
  Settings2,
  RotateCcw,
  UserCheck,
  TrendingUp,
  FileText,
  AtSign,
  GraduationCap,
  Sparkles,
  Lock,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { WidgetType, AVAILABLE_WIDGETS, UserWidgetPreferences } from '@/types/dashboard';

interface CustomizeWidgetsModalProps {
  preferences: UserWidgetPreferences;
  onToggleWidget: (id: WidgetType) => void;
  onReset: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  BarChart3: <BarChart3 className="h-5 w-5" />,
  CheckSquare: <CheckSquare className="h-5 w-5" />,
  FolderKanban: <FolderKanban className="h-5 w-5" />,
  Target: <Target className="h-5 w-5" />,
  GraduationCap: <GraduationCap className="h-5 w-5" />,
  UserCheck: <UserCheck className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  Briefcase: <Briefcase className="h-5 w-5" />,
  StickyNote: <StickyNote className="h-5 w-5" />,
  MessageCircle: <MessageCircle className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  AtSign: <AtSign className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
};

const TITLE_ICON_MAP: Record<string, React.ReactNode> = {
  lock: <Lock className="h-3.5 w-3.5 text-gray-400" />,
  info: <Info className="h-3.5 w-3.5 text-gray-400" />,
  sparkles: <Sparkles className="h-3.5 w-3.5 text-purple-500" />,
};

export function CustomizeWidgetsModal({
  preferences,
  onToggleWidget,
  onReset,
}: CustomizeWidgetsModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize your Home</DialogTitle>
          <DialogDescription>
            Choose which widgets to display on your dashboard. Drag widgets to reorder them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
          <div className="space-y-2">
            {AVAILABLE_WIDGETS.map((widget) => {
              const isEnabled = preferences.visibleWidgets.includes(widget.id);

              return (
                <div
                  key={widget.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                      {ICON_MAP[widget.icon]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-900">{widget.title}</p>
                        {widget.titleIcon && TITLE_ICON_MAP[widget.titleIcon]}
                      </div>
                      <p className="text-sm text-gray-500">{widget.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => onToggleWidget(widget.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </Button>
          <Button onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
