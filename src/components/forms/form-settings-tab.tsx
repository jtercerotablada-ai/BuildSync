'use client';

import { useState } from 'react';
import {
  List,
  Type,
  User,
  Building2,
  Globe,
  Users,
  Check,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mock data
const MOCK_SECTIONS = [
  { id: '1', name: 'To do' },
  { id: '2', name: 'In progress' },
  { id: '3', name: 'Done' },
  { id: '4', name: 'Backlog' },
];

const MOCK_TITLE_FIELDS = [
  { id: '1', name: 'Form name' },
  { id: '2', name: 'Task name' },
  { id: '3', name: 'Title' },
  { id: '4', name: 'Subject' },
];

const MOCK_USERS = [
  { id: 'none', name: 'No assignee', initials: '' },
  { id: '1', name: 'Juan Tercero', initials: 'JT' },
  { id: '2', name: 'Maria Garcia', initials: 'MG' },
];

const ACCESS_OPTIONS = [
  { value: 'organization', label: 'Organization only', icon: Building2 },
  { value: 'anyone', label: 'Anyone with the link', icon: Globe },
  { value: 'specific', label: 'Specific people', icon: Users },
];

export interface FormSettingsState {
  // Task settings
  selectedSection: string;
  selectedTitleField: string;
  defaultAssignee: string;
  copyResponsesToDescription: boolean;
  // Form settings
  accessLevel: 'organization' | 'anyone' | 'specific';
  formLink: string;
  embedCode: string;
  confirmationMessage: string;
  showAddNewRequestButton: boolean;
  // Replies
  addSubmittersAsCollaborators: boolean;
  receiveEmailReplies: boolean;
  sendEmailReplies: boolean;
}

interface FormSettingsTabProps {
  formId?: string;
  settings: FormSettingsState;
  onSettingsChange: (settings: FormSettingsState) => void;
}

export function FormSettingsTab({
  formId = 'abc123',
  settings,
  onSettingsChange,
}: FormSettingsTabProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const updateSetting = <K extends keyof FormSettingsState>(
    key: K,
    value: FormSettingsState[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(settings.formLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(settings.embedCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const selectedAccess = ACCESS_OPTIONS.find(
    (opt) => opt.value === settings.accessLevel
  );
  const AccessIcon = selectedAccess?.icon || Building2;

  return (
    <div className="space-y-6">
      {/* ========== TASK SETTINGS ========== */}
      <section className="space-y-4">
        <h3 className="font-semibold text-sm text-gray-900">Task settings</h3>

        {/* Select a section for tasks */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700">Select a section for tasks</label>
          <Select
            value={settings.selectedSection}
            onValueChange={(value) => updateSetting('selectedSection', value)}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="First project section">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-gray-500" />
                  <span>
                    {MOCK_SECTIONS.find((s) => s.id === settings.selectedSection)?.name ||
                      'First project section'}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MOCK_SECTIONS.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-gray-500" />
                    <span>{section.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select a field for task titles */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700">Select a field for task titles</label>
          <Select
            value={settings.selectedTitleField}
            onValueChange={(value) => updateSetting('selectedTitleField', value)}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Form name">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-gray-500" />
                  <span>
                    {MOCK_TITLE_FIELDS.find((f) => f.id === settings.selectedTitleField)
                      ?.name || 'Form name'}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MOCK_TITLE_FIELDS.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-gray-500" />
                    <span>{field.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default assignee */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700">Default assignee</label>
          <Select
            value={settings.defaultAssignee}
            onValueChange={(value) => updateSetting('defaultAssignee', value)}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="No assignee">
                {settings.defaultAssignee && settings.defaultAssignee !== 'none' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center text-white text-[10px] font-medium">
                      {MOCK_USERS.find((u) => u.id === settings.defaultAssignee)?.initials}
                    </div>
                    <span>
                      {MOCK_USERS.find((u) => u.id === settings.defaultAssignee)?.name}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">No assignee</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MOCK_USERS.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    {user.id !== 'none' ? (
                      <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center text-white text-[10px] font-medium">
                        {user.initials}
                      </div>
                    ) : (
                      <User className="h-4 w-4 text-gray-400" />
                    )}
                    <span>{user.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Copy all responses toggle */}
        <div className="flex items-center gap-3">
          <Switch
            checked={settings.copyResponsesToDescription}
            onCheckedChange={(checked) =>
              updateSetting('copyResponsesToDescription', checked)
            }
            className="data-[state=checked]:bg-blue-500"
          />
          <span className="text-sm text-gray-700">
            Copy all responses to task description
          </span>
        </div>
      </section>

      {/* ========== FORM SETTINGS ========== */}
      <section className="space-y-4">
        <h3 className="font-semibold text-sm text-gray-900">Form settings</h3>

        {/* Select who can access the form */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700">Select who can access the form</label>
          <Select
            value={settings.accessLevel}
            onValueChange={(value) =>
              updateSetting('accessLevel', value as 'organization' | 'anyone' | 'specific')
            }
          >
            <SelectTrigger className="bg-white">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <AccessIcon className="h-4 w-4 text-gray-500" />
                  <span>{selectedAccess?.label}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ACCESS_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-500" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Share this link directly */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700">Share this link directly</label>
          <div className="flex gap-2">
            <Input
              value={settings.formLink}
              readOnly
              className="flex-1 bg-gray-50 text-gray-500 text-sm truncate"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex-shrink-0 whitespace-nowrap"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied!
                </>
              ) : (
                'Copy link'
              )}
            </Button>
          </div>
        </div>

        {/* Copy embed code */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700">Copy embed code</label>
          <div className="flex gap-2">
            <Input
              value={settings.embedCode}
              readOnly
              className="flex-1 bg-gray-50 text-gray-500 text-sm truncate font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="flex-shrink-0 whitespace-nowrap"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied!
                </>
              ) : (
                'Copy code'
              )}
            </Button>
          </div>
        </div>

        {/* Confirmation message */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-700">Confirmation message</label>
          <Textarea
            value={settings.confirmationMessage}
            onChange={(e) => updateSetting('confirmationMessage', e.target.value)}
            placeholder="Your submission has been received"
            className="bg-white resize-none"
            rows={3}
          />
        </div>

        {/* Show add new request button toggle */}
        <div className="flex items-center gap-3">
          <Switch
            checked={settings.showAddNewRequestButton}
            onCheckedChange={(checked) =>
              updateSetting('showAddNewRequestButton', checked)
            }
            className="data-[state=checked]:bg-blue-500"
          />
          <span className="text-sm text-gray-700">
            Show a button to "Add new request"
          </span>
        </div>
      </section>

      {/* ========== REPLIES ========== */}
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Replies</h3>
          <p className="text-xs text-gray-500">
            Manage how your organization receives updates
          </p>
        </div>

        {/* Add submitters as collaborators */}
        <div className="flex items-start gap-3">
          <Switch
            checked={settings.addSubmittersAsCollaborators}
            onCheckedChange={(checked) =>
              updateSetting('addSubmittersAsCollaborators', checked)
            }
            className="data-[state=checked]:bg-blue-500 mt-0.5"
          />
          <div>
            <span className="text-sm text-gray-700 block">
              Add submitters in my organization as task collaborators
            </span>
            <span className="text-xs text-gray-500">
              Allows access to edit the task and see comments
            </span>
          </div>
        </div>

        {/* Receive email replies */}
        <div className="flex items-start gap-3">
          <Switch
            checked={settings.receiveEmailReplies}
            onCheckedChange={(checked) =>
              updateSetting('receiveEmailReplies', checked)
            }
            className="data-[state=checked]:bg-blue-500 mt-0.5"
          />
          <div>
            <span className="text-sm text-gray-700 block">Receive email replies</span>
            <span className="text-xs text-gray-500">
              Submitters can reply to their confirmation email to add comments
            </span>
          </div>
        </div>

        {/* Send email replies */}
        <div className="flex items-start gap-3">
          <Switch
            checked={settings.sendEmailReplies}
            onCheckedChange={(checked) => updateSetting('sendEmailReplies', checked)}
            className="data-[state=checked]:bg-blue-500 mt-0.5"
          />
          <div>
            <span className="text-sm text-gray-700 block">Send email replies</span>
            <span className="text-xs text-gray-500">
              Allows task collaborators to email comments to submitters
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// Default settings factory
export function getDefaultFormSettings(formId?: string): FormSettingsState {
  const id = formId || 'abc123';
  return {
    selectedSection: '1',
    selectedTitleField: '1',
    defaultAssignee: 'none',
    copyResponsesToDescription: true,
    accessLevel: 'organization',
    formLink: `https://form.buildsync.com/f/${id}`,
    embedCode: `<div class="buildsync-embed" data-form-id="${id}"></div>`,
    confirmationMessage: 'Your submission has been received',
    showAddNewRequestButton: false,
    addSubmittersAsCollaborators: false,
    receiveEmailReplies: false,
    sendEmailReplies: false,
  };
}
