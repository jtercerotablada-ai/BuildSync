import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

/** Google Calendar — official multicolor mark at 16px */
export function GoogleCalendarIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("w-4 h-4", className)}
    >
      {/* Blue top-right */}
      <path d="M18 4h-1V3a1 1 0 0 0-2 0v1H9V3a1 1 0 0 0-2 0v1H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" fill="#fff" />
      <path d="M18 4h-1V3a1 1 0 0 0-2 0v1H9V3a1 1 0 0 0-2 0v1H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" stroke="#4285F4" strokeWidth="0" />
      <rect x="4" y="8" width="16" height="12" rx="0" fill="#fff" />
      <rect x="4" y="4" width="16" height="4" rx="0" fill="#4285F4" />
      {/* Grid lines */}
      <rect x="6.5" y="10.5" width="3" height="2.5" rx="0.5" fill="#4285F4" />
      <rect x="10.5" y="10.5" width="3" height="2.5" rx="0.5" fill="#34A853" />
      <rect x="14.5" y="10.5" width="3" height="2.5" rx="0.5" fill="#FBBC04" />
      <rect x="6.5" y="14.5" width="3" height="2.5" rx="0.5" fill="#EA4335" />
      <rect x="10.5" y="14.5" width="3" height="2.5" rx="0.5" fill="#4285F4" />
      <rect x="14.5" y="14.5" width="3" height="2.5" rx="0.5" fill="#34A853" />
      {/* Border */}
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="#DADCE0" strokeWidth="0.5" fill="none" />
    </svg>
  );
}

/** Outlook Calendar — blue calendar with O mark */
export function OutlookCalendarIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("w-4 h-4", className)}
    >
      <rect x="3" y="4" width="18" height="17" rx="2" fill="#0078D4" />
      <rect x="3" y="4" width="18" height="4" fill="#005A9E" rx="2" />
      <rect x="5.5" y="10" width="13" height="9" rx="1" fill="#fff" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#0078D4"
      >
        O
      </text>
    </svg>
  );
}

/** Google Sheets — green spreadsheet icon */
export function GoogleSheetsIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("w-4 h-4", className)}
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        fill="#0F9D58"
      />
      <path d="M14 2v6h6" fill="#87CEAC" />
      {/* Grid */}
      <rect x="7" y="11" width="10" height="8" rx="0.5" fill="#fff" />
      <line x1="7" y1="13.5" x2="17" y2="13.5" stroke="#0F9D58" strokeWidth="0.5" />
      <line x1="7" y1="16" x2="17" y2="16" stroke="#0F9D58" strokeWidth="0.5" />
      <line x1="11" y1="11" x2="11" y2="19" stroke="#0F9D58" strokeWidth="0.5" />
    </svg>
  );
}

/** iCal / Apple Calendar — neutral calendar with date */
export function ICalIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("w-4 h-4", className)}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
        fill="currentColor"
        stroke="none"
      >
        17
      </text>
    </svg>
  );
}
