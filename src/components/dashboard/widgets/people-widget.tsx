'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Person {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role?: string;
}

export function PeopleWidget() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPeople() {
      try {
        const res = await fetch('/api/users?limit=6');
        if (res.ok) {
          const data = await res.json();
          setPeople(data);
        }
      } catch (error) {
        console.error('Failed to fetch people:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPeople();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header con dropdown */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-gray-500 h-7 px-2">
              Frequent collaborators
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Frequent collaborators</DropdownMenuItem>
            <DropdownMenuItem>All team members</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {loading ? (
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : people.length === 0 ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="w-10 h-10 rounded-full bg-gray-300 absolute -right-2 top-1" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Invite your team members to collaborate
            </p>
            <Button variant="outline" size="sm">
              Invite team members
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center">
            {people.map((person) => (
              <button
                key={person.id}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
                onClick={() => router.push(`/team/${person.id}`)}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={person.image || undefined} />
                  <AvatarFallback>{person.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-600">{person.name?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
