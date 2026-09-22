// The portal shell renders the SAME project page as the dashboard shell. This
// used to be a separate copy with its own read rule, task query and payload,
// and the copies drifted: it granted access the API refused, refused access
// the API granted, and showed colleagues' private tasks. ProjectContent derives
// its link prefix from the pathname, so one page serves both shells.
export { default } from "@/app/(dashboard)/projects/[projectId]/page";
