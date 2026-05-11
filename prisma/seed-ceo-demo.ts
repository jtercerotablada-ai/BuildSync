/**
 * Seed the workspace of the first OWNER user with a demo portfolio of
 * engineering projects across all 4 types and major locations.
 *
 * Idempotent: re-running upserts by `name` within the workspace.
 *
 * Run with:
 *   npx tsx prisma/seed-ceo-demo.ts
 */

import { PrismaClient, ProjectType, ProjectGate, ProjectStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface DemoProject {
  name: string;
  description: string;
  color: string;
  type: ProjectType;
  gate: ProjectGate;
  status: ProjectStatus;
  location: string;
  latitude: number;
  longitude: number;
  budget: number;
  currency: string;
  clientName: string;
  startOffsetDays: number;
  durationDays: number;
}

const DEMO: DemoProject[] = [
  {
    name: "Torre Residencial Polanco",
    description: "30-story residential tower with post-tensioned slab system",
    color: "#c9a84c",
    type: "CONSTRUCTION",
    gate: "CONSTRUCTION",
    status: "ON_TRACK",
    location: "Mexico City, MX",
    latitude: 19.4326,
    longitude: -99.1332,
    budget: 8400000,
    currency: "USD",
    clientName: "Grupo Inmobiliario Polanco S.A.",
    startOffsetDays: -120,
    durationDays: 420,
  },
  {
    name: "Brickell Mixed-Use Complex",
    description: "Hybrid concrete + steel mixed-use tower, downtown Miami",
    color: "#4573D2",
    type: "DESIGN",
    gate: "DESIGN",
    status: "ON_TRACK",
    location: "Miami, FL, USA",
    latitude: 25.7617,
    longitude: -80.1918,
    budget: 14200000,
    currency: "USD",
    clientName: "Brickell Capital Partners",
    startOffsetDays: -45,
    durationDays: 180,
  },
  {
    name: "NYC FISP Cycle 9 — 521 West 57th",
    description: "Façade Inspection & Safety Program recertification, NYC LL11",
    color: "#a8893a",
    type: "RECERTIFICATION",
    gate: "PERMITTING",
    status: "AT_RISK",
    location: "New York, NY, USA",
    latitude: 40.7681,
    longitude: -73.9867,
    budget: 285000,
    currency: "USD",
    clientName: "521 W 57 Owners Corp",
    startOffsetDays: -30,
    durationDays: 50,
  },
  {
    name: "Wynwood Warehouse Conversion",
    description: "Adaptive reuse: industrial warehouse → creative office",
    color: "#5a8f5e",
    type: "DESIGN",
    gate: "PRE_DESIGN",
    status: "ON_TRACK",
    location: "Miami, FL, USA",
    latitude: 25.8011,
    longitude: -80.1989,
    budget: 6500000,
    currency: "USD",
    clientName: "Wynwood Creative Holdings",
    startOffsetDays: -10,
    durationDays: 270,
  },
  {
    name: "Brooklyn Bridge Park Pavilion",
    description: "Steel + glass civic pavilion, public works",
    color: "#9b6dc4",
    type: "CONSTRUCTION",
    gate: "CONSTRUCTION",
    status: "ON_TRACK",
    location: "Brooklyn, NY, USA",
    latitude: 40.7024,
    longitude: -73.9967,
    budget: 4100000,
    currency: "USD",
    clientName: "NYC Parks Department",
    startOffsetDays: -200,
    durationDays: 300,
  },
  {
    name: "Coral Gables Permit — 4040 Anderson",
    description: "Building permit application + structural code review",
    color: "#d28a4a",
    type: "PERMIT",
    gate: "PERMITTING",
    status: "AT_RISK",
    location: "Coral Gables, FL, USA",
    latitude: 25.7215,
    longitude: -80.2684,
    budget: 75000,
    currency: "USD",
    clientName: "Anderson Realty LLC",
    startOffsetDays: -20,
    durationDays: 40,
  },
  {
    name: "CDMX Hospital Vertical Expansion",
    description: "2-story vertical addition to existing hospital, seismic upgrade",
    color: "#c44a5a",
    type: "DESIGN",
    gate: "DESIGN",
    status: "OFF_TRACK",
    location: "Mexico City, MX",
    latitude: 19.3621,
    longitude: -99.1738,
    budget: 5800000,
    currency: "USD",
    clientName: "Secretaría de Salud CDMX",
    startOffsetDays: -90,
    durationDays: 220,
  },
  {
    name: "FISP Cycle 9 — 200 East 87th",
    description: "Façade recert, brick + terracotta cornice condition assessment",
    color: "#a8893a",
    type: "RECERTIFICATION",
    gate: "DESIGN",
    status: "ON_TRACK",
    location: "New York, NY, USA",
    latitude: 40.7791,
    longitude: -73.9518,
    budget: 195000,
    currency: "USD",
    clientName: "200 E 87 Cooperators",
    startOffsetDays: -15,
    durationDays: 75,
  },
  {
    name: "Bogotá Office Tower — Avenida Chile",
    description: "20-story Class A office tower with PT slabs",
    color: "#4573D2",
    type: "CONSTRUCTION",
    gate: "CONSTRUCTION",
    status: "ON_TRACK",
    location: "Bogotá, CO",
    latitude: 4.6486,
    longitude: -74.0539,
    budget: 11600000,
    currency: "USD",
    clientName: "Pareja & Asociados S.A.S.",
    startOffsetDays: -250,
    durationDays: 540,
  },
  {
    name: "Edgewater Tower II — Closeout",
    description: "Punch list + sealed drawings closeout, post-completion",
    color: "#666666",
    type: "CONSTRUCTION",
    gate: "CLOSEOUT",
    status: "ON_TRACK",
    location: "Miami, FL, USA",
    latitude: 25.8159,
    longitude: -80.1879,
    budget: 9200000,
    currency: "USD",
    clientName: "Edgewater Group LLC",
    startOffsetDays: -560,
    durationDays: 600,
  },
];

async function main() {
  console.log("🏗️  Seeding BuildSync CEO demo data...\n");

  // Find the first OWNER user — that's our CEO
  const owner = await prisma.user.findFirst({
    where: { workspaceMembers: { some: { role: "OWNER" } } },
    include: { workspaceMembers: { take: 1, orderBy: { joinedAt: "asc" } } },
  });

  if (!owner) {
    console.error("❌ No OWNER user found. Sign up and create a workspace first.");
    process.exit(1);
  }
  const workspaceId = owner.workspaceMembers[0].workspaceId;
  console.log(`✅ Using workspace ${workspaceId} (owner: ${owner.email})\n`);

  const now = Date.now();

  for (const d of DEMO) {
    const startDate = new Date(now + d.startOffsetDays * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + d.durationDays * 24 * 60 * 60 * 1000);

    const existing = await prisma.project.findFirst({
      where: { workspaceId, name: d.name },
    });

    const data = {
      name: d.name,
      description: d.description,
      color: d.color,
      type: d.type,
      gate: d.gate,
      status: d.status,
      location: d.location,
      latitude: d.latitude,
      longitude: d.longitude,
      budget: d.budget,
      currency: d.currency,
      clientName: d.clientName,
      startDate,
      endDate,
      workspaceId,
      ownerId: owner.id,
    };

    if (existing) {
      await prisma.project.update({ where: { id: existing.id }, data });
      console.log(`  ↻  Updated: ${d.name}`);
    } else {
      const project = await prisma.project.create({
        data: {
          ...data,
          members: { create: { userId: owner.id, role: "ADMIN" } },
          sections: {
            createMany: {
              data: [
                { name: "To do", position: 0 },
                { name: "In progress", position: 1 },
                { name: "Done", position: 2 },
              ],
            },
          },
        },
      });

      // Sample tasks per project — 3 tasks with varied due dates
      const sections = await prisma.section.findMany({
        where: { projectId: project.id },
        orderBy: { position: "asc" },
      });

      const dueOffsets = [3, 14, 45];
      const taskNames: Record<ProjectType, string[]> = {
        CONSTRUCTION: ["Site visit + RFI review", "Submit shop drawing comments", "Sealed punch list"],
        DESIGN: ["Schematic design package", "Coordination meeting w/ arch", "Issue 50% CDs"],
        RECERTIFICATION: ["Field probe inspection", "Draft TR6 report", "File with DOB"],
        PERMIT: ["Submit structural plans", "Address plan examiner comments", "Receive permit"],
      };
      for (let i = 0; i < 3; i++) {
        await prisma.task.create({
          data: {
            name: taskNames[d.type][i] ?? "Task",
            projectId: project.id,
            sectionId: sections[i % sections.length].id,
            creatorId: owner.id,
            assigneeId: owner.id,
            dueDate: new Date(now + dueOffsets[i] * 24 * 60 * 60 * 1000),
            priority: i === 0 ? "HIGH" : i === 1 ? "MEDIUM" : "LOW",
          },
        });
      }

      console.log(`  ✨  Created: ${d.name}`);
    }
  }

  console.log("\n✅ Done. Run `npm run dev` and visit /home to see the cockpit.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
