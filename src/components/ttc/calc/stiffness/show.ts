/**
 * HOW THE DRAWING IS LOOKED AT, as a few pure rules (no React): the switches under the drawing, and what opening a structure or loading a
 * problem does to them.
 *
 * Two switches follow the SIZE of the structure by themselves: a structure of many members has no room for a tag on each, and one of many
 * nodes none for the numbers of the degrees of freedom - so those two start off for such a structure. The rule is that of a THRESHOLD,
 * and it acts when the structure crosses it, not each time a structure is opened: a visitor who turned a switch on or off has chosen, and
 * opening another structure of the same size keeps what they chose. "Start over" is the one thing that sets every switch back.
 */

export interface Show {
  loads: boolean;
  reactions: boolean;
  deformed: boolean;
  dofs: boolean;
  nodeNumbers: boolean;
  memberNumbers: boolean;
  values: boolean;
  every: boolean;
  /** The size class the two automatic switches (member numbers, DOF numbers) were last set for. */
  few: { members: boolean; nodes: boolean };
}

/** Most members that still have a tag each, and most nodes that still have their DOF numbers written beside them. */
export const MEMBERS_WITH_TAGS = 12;
export const NODES_WITH_DOFS = 6;

export const sizeClass = (form: { members: readonly unknown[]; nodes: readonly unknown[] }): Show['few'] => ({ members: form.members.length <= MEMBERS_WITH_TAGS, nodes: form.nodes.length <= NODES_WITH_DOFS });

/** Every switch at its start, the two automatic ones as the structure's size says. */
export function startShow(form: { members: readonly unknown[]; nodes: readonly unknown[] }): Show {
  const few = sizeClass(form);
  return { loads: true, reactions: true, deformed: true, dofs: few.nodes, nodeNumbers: true, memberNumbers: few.members, values: true, every: false, few };
}

/** The switches after a structure replaces the one before: the visitor's choices stay, but for an automatic switch whose structure crossed its threshold. */
export function showFor(form: { members: readonly unknown[]; nodes: readonly unknown[] }, s: Show): Show {
  const few = sizeClass(form);
  return {
    ...s,
    memberNumbers: few.members !== s.few.members ? few.members : s.memberNumbers,
    dofs: few.nodes !== s.few.nodes ? few.nodes : s.dofs,
    few,
  };
}
