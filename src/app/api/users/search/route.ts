import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-utils';
import {
  getErrorStatus,
  getPrimaryWorkspaceMembership,
  verifyProjectAccess,
  verifyTaskAccess,
  verifyWorkspaceAccess,
} from '@/lib/auth-guards';
import type { WorkspaceRole } from '@prisma/client';
import { NON_CONTRIBUTOR_ROLES } from '@/lib/workspace-roles';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Scope to ONE workspace: the caller's primary one, or an explicit
    // ?workspaceId= they belong to. Listing users from every workspace the
    // caller is in let the assignee/member pickers offer accounts from a
    // side workspace, and picking one handed that account a firm task.
    // ?taskId= (the assignee picker) wins: candidates come from the task's
    // own project workspace — or, for a project-less task, the caller's
    // primary one — and only contributors are offered, since GUEST/CLIENT
    // accounts cannot work a task.
    // ?projectId= (project members dialog, people fields) scopes to that
    // project's own workspace: the primary-workspace fallback would offer the
    // wrong roster whenever the project lives in another workspace.
    const requestedWorkspaceId = searchParams.get('workspaceId');
    const taskId = searchParams.get('taskId');
    const projectId = searchParams.get('projectId');
    let workspaceId: string;
    if (taskId) {
      let taskWorkspaceId: string | null = null;
      try {
        const task = await verifyTaskAccess(userId, taskId);
        taskWorkspaceId = task.project?.workspaceId ?? null;
      } catch (error) {
        const { status, message } = getErrorStatus(error);
        return NextResponse.json({ error: message }, { status });
      }
      if (taskWorkspaceId) {
        workspaceId = taskWorkspaceId;
      } else {
        const primary = await getPrimaryWorkspaceMembership(userId);
        if (!primary) return NextResponse.json([]);
        workspaceId = primary.workspaceId;
      }
    } else if (projectId) {
      try {
        const { project } = await verifyProjectAccess(userId, projectId);
        workspaceId = project.workspaceId;
      } catch (error) {
        const { status, message } = getErrorStatus(error);
        return NextResponse.json({ error: message }, { status });
      }
    } else if (requestedWorkspaceId) {
      try {
        await verifyWorkspaceAccess(userId, requestedWorkspaceId);
      } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      workspaceId = requestedWorkspaceId;
    } else {
      const primary = await getPrimaryWorkspaceMembership(userId);
      if (!primary) return NextResponse.json([]);
      workspaceId = primary.workspaceId;
    }

    // Find users in that workspace
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          {
            workspaceMembers: {
              some: {
                workspaceId,
                ...(taskId
                  ? { role: { notIn: [...NON_CONTRIBUTOR_ROLES] as WorkspaceRole[] } }
                  : {}),
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
