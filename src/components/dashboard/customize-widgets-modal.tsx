'use client';

/**
 * CustomizeWidgetsModal — side-drawer (Sheet) replacing the centered
 * dialog. Mirrors Asana's "Personalize" panel which slides in from the
 * right with: (1) a background-color picker for the Home page, and
 * (2) the widgets toggle list.
 *
 * The export name is unchanged so existing imports keep working even
 * though the underlying primitive is now a Sheet.
 */

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
  AlertTriangle,
  Flag,
  ShieldCheck,
  Activity,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { WidgetType, AVAILABLE_WIDGETS, UserWidgetPreferences } from '@/types/dashboard';
import { HOME_BACKGROUND_PALETTE, type HomeBackgroundId } from '@/lib/home-background';

interface CustomizeWidgetsModalProps {
  preferences: UserWidgetPreferences;
  onToggleWidget: (id: WidgetType) => void;
  onReset: () => void;
  // Optional — when both are provided, the sheet shows a color picker
  // that lets the user tint the page background. Pages that don't want
  // the color picker (e.g. portal/dashboard) simply omit these props.
  backgroundId?: HomeBackgroundId;
  onBackgroundChange?: (id: HomeBackgroundId) => void;
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
  AlertTriangle: <AlertTriangle className="h-5 w-5" />,
  Flag: <Flag className="h-5 w-5" />,
  ShieldCheck: <ShieldCheck className="h-5 w-5" />,
  Activity: <Activity className="h-5 w-5" />,
};

const TITLE_ICON_MAP: Record<string, React.ReactNode> = {
  lock: <Lock className="h-3.5 w-3.5 text-gray-400" />,
  info: <Info className="h-3.5 w-3.5 text-gray-400" />,
  sparkles: <Sparkles className="h-3.5 w-3.5 text-[#a8893a]" />,
};

export function CustomizeWidgetsModal({
  preferences,
  onToggleWidget,
  onReset,
  backgroundId,
  onBackgroundChange,
}: CustomizeWidgetsModalProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Settings2 className="h-3.5 w-3.5" />
          Customize
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-lg">Customize your Home</SheetTitle>
          <SheetDescription>
            Pick a background color and choose which widgets show up.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {onBackgroundChange && backgroundId && (
            <>
              <section className="px-6 py-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Background
                </h3>
                <div className="grid grid-cols-8 gap-2">
                  {HOME_BACKGROUND_PALETTE.map((bg) => {
                    const selected = bg.id === backgroundId;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        aria-label={bg.label}
                        onClick={() => onBackgroundChange(bg.id)}
                        className="relative h-8 w-8 rounded-full border border-gray-300 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                        style={{ backgroundColor: bg.swatch }}
                      >
                        {selected && (
                          <Check
                            className="absolute inset-0 m-auto h-4 w-4"
                            style={{ color: bg.checkColor }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
              <Separator />
            </>
          )}

          <section className="px-6 py-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Widgets
            </h3>
            <div className="space-y-2">
              {AVAILABLE_WIDGETS.map((widget) => {
                const isEnabled = preferences.visibleWidgets.includes(widget.id);
                return (
                  <div
                    key={widget.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-gray-100 text-gray-600 flex-shrink-0">
                        {ICON_MAP[widget.icon]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {widget.title}
                          </p>
                          {widget.titleIcon && TITLE_ICON_MAP[widget.titleIcon]}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {widget.description}
                        </p>
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
          </section>
        </div>

        <SheetFooter className="px-6 py-4 border-t bg-background flex-row justify-between gap-0">
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
