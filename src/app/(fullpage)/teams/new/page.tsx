'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  ArrowLeft,
  X,
  Users,
  Lock,
  Mail,
  Check,
  LayoutGrid,
  Calendar,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

type PrivacyType = 'PUBLIC' | 'REQUEST_TO_JOIN' | 'PRIVATE';

const PRIVACY_OPTIONS = [
  {
    value: 'REQUEST_TO_JOIN' as PrivacyType,
    label: 'Membership by request',
    description: 'A member has to request to join this team',
    icon: Mail,
  },
  {
    value: 'PRIVATE' as PrivacyType,
    label: 'Private',
    description: 'A member must be invited to join this team',
    icon: Lock,
  },
  {
    value: 'PUBLIC' as PrivacyType,
    label: 'Public to organization',
    description: 'Any member can join this team',
    icon: Users,
  },
];

export default function CreateTeamPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  // Form state
  const [teamName, setTeamName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [isEndorsed, setIsEndorsed] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacyType>('PUBLIC');

  // Search state
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Current user
  const currentUser: User | null = session?.user
    ? {
        id: (session.user as User & { id: string }).id || '',
        name: session.user.name || null,
        email: session.user.email || '',
        image: session.user.image || null,
      }
    : null;

  // Add current user as default member
  useEffect(() => {
    if (currentUser && selectedMembers.length === 0) {
      setSelectedMembers([currentUser]);
    }
  }, [currentUser]);

  // Search users as they type
  useEffect(() => {
    const searchUsers = async () => {
      if (!memberSearch.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(memberSearch)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already selected members
          const filtered = data.filter(
            (user: User) => !selectedMembers.some((m) => m.id === user.id)
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [memberSearch, selectedMembers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddMember = (user: User) => {
    setSelectedMembers((prev) => [...prev, user]);
    setMemberSearch('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveMember = (userId: string) => {
    // Don't allow removing current user
    if (userId === currentUser?.id) return;
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      toast.error('Team name is required');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: teamName,
        privacy,
        memberIds: selectedMembers.map((m) => m.id),
      };

      console.log('Creating team with payload:', payload);

      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Team creation failed:', data);
        throw new Error(data.error || 'Failed to create team');
      }

      console.log('Team created successfully:', data);
      toast.success('Team created successfully');
      router.push(`/teams/${data.id}`);
    } catch (error) {
      console.error('Error creating team:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    // Generate initials from email (e.g., "juantercero766" -> "JU")
    const emailName = email.split('@')[0];
    return emailName.substring(0, 2).toUpperCase();
  };

  // Generate consistent color based on email/name
  const getAvatarColor = (identifier: string) => {
    const colors = ['#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
    const index = identifier.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const goBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation buttons */}
      <div className="fixed top-4 left-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="h-10 w-10 rounded-full bg-white shadow-sm border hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="fixed top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="h-10 w-10 rounded-full bg-white shadow-sm border hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto py-16 px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column - Form */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Create a new team
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Team name */}
              <div className="space-y-2">
                <Label htmlFor="teamName" className="text-sm font-medium">
                  Team name
                </Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder='For example: "Marketing" or "Design"'
                  className="focus-visible:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Members */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Members</Label>
                <div className="relative" ref={dropdownRef}>
                  {/* Input container with chips inside */}
                  <div
                    className={cn(
                      'flex flex-wrap items-center gap-2 p-2 border rounded-md bg-white min-h-[42px] cursor-text',
                      'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
                    )}
                    onClick={() => inputRef.current?.focus()}
                  >
                    {/* Selected members chips */}
                    {selectedMembers.map((member) => (
                      <div
                        key={member.id}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-sm"
                      >
                        <span className="text-gray-700 truncate max-w-[140px]">
                          {member.name || member.email}
                        </span>
                        {!member.name && (
                          <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        )}
                        {member.id !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMember(member.id);
                            }}
                            className="text-gray-400 hover:text-gray-600 ml-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Text input */}
                    <input
                      ref={inputRef}
                      type="text"
                      value={memberSearch}
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder={selectedMembers.length === 0 ? 'Add team members by name or email...' : ''}
                      className="flex-1 min-w-[150px] outline-none text-sm bg-transparent"
                    />
                  </div>

                  {/* Dropdown */}
                  {showDropdown && (memberSearch.trim() || searchLoading) && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-60 overflow-y-auto">
                      {searchLoading ? (
                        <div className="p-3 text-sm text-gray-500">Searching...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">No users found</div>
                      ) : (
                        searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleAddMember(user)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.image || undefined} />
                              <AvatarFallback className="bg-blue-500 text-white text-sm">
                                {getInitials(user.name, user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">
                                {user.name || user.email}
                              </div>
                              {user.name && (
                                <div className="text-xs text-gray-500">{user.email}</div>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Team status (Endorsed) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Team status</Label>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Checkbox
                    id="endorsed"
                    checked={isEndorsed}
                    onCheckedChange={(checked) => setIsEndorsed(checked as boolean)}
                    disabled
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="endorsed"
                        className="text-sm font-medium text-gray-400 cursor-not-allowed"
                      >
                        Endorsed
                      </label>
                      <Check className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-orange-500 font-medium">
                        Premium feature
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Endorsed teams are recommended by admins in your organization.
                    </p>
                  </div>
                </div>
              </div>

              {/* Team privacy */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Team privacy</Label>
                <div className="space-y-2">
                  {PRIVACY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <label
                        key={option.value}
                        className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="privacy"
                          value={option.value}
                          checked={privacy === option.value}
                          onChange={() => setPrivacy(option.value)}
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <Icon className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{option.label}</div>
                          <div className="text-xs text-gray-500">{option.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading || !teamName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-200 disabled:text-gray-400"
              >
                {loading ? 'Creating...' : 'Create new team'}
              </Button>
            </form>
          </div>

          {/* Right Column - Preview */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sticky top-24">
              {/* Team header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-gray-100">
                  <Users className="h-7 w-7 text-gray-500" />
                </div>
                <div className="h-3 w-3 rounded-full bg-gray-200" />
              </div>

              {/* Team name preview */}
              {teamName && (
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {teamName}
                </h3>
              )}

              {/* Members section */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 mb-3">Members</h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Real selected members */}
                  {selectedMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.image || undefined} />
                        <AvatarFallback
                          className="text-white text-xs"
                          style={{ backgroundColor: getAvatarColor(member.email) }}
                        >
                          {getInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-900 truncate">
                        {member.name || member.email.split('@')[0]}
                      </span>
                    </div>
                  ))}

                  {/* Placeholder members */}
                  {Array.from({ length: Math.max(0, 6 - selectedMembers.length) }).map(
                    (_, i) => (
                      <div key={`placeholder-${i}`} className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gray-200" />
                        <div className="h-3 w-20 bg-gray-200 rounded" />
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Projects section */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">Projects</h4>
                <div className="space-y-3">
                  {/* Placeholder project 1 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                        <LayoutGrid className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                    </div>
                    <div className="flex -space-x-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-5 w-5 rounded-full bg-gray-200 border-2 border-white"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Placeholder project 2 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="h-3 w-28 bg-gray-200 rounded" />
                    </div>
                    <div className="flex -space-x-1">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-5 w-5 rounded-full bg-gray-200 border-2 border-white"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy indicator */}
              <div className="mt-6 pt-4 border-t flex items-center gap-2 text-xs text-gray-500">
                {privacy === 'PUBLIC' && (
                  <>
                    <Users className="h-3.5 w-3.5" />
                    <span>Public to organization</span>
                  </>
                )}
                {privacy === 'PRIVATE' && (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Private team</span>
                  </>
                )}
                {privacy === 'REQUEST_TO_JOIN' && (
                  <>
                    <Mail className="h-3.5 w-3.5" />
                    <span>Membership by request</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
