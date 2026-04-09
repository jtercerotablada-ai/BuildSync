import type { CollisionDetection } from '@dnd-kit/core';
import {
  pointerWithin,
  rectIntersection,
  closestCenter,
  getFirstCollision,
} from '@dnd-kit/core';

/**
 * Custom collision detection for kanban boards.
 *
 * `closestCenter` fails when dragging into empty columns because task cards
 * in adjacent populated columns have centers closer to the cursor than the
 * empty column's center. This strategy:
 *
 * 1. Separates droppables into columns (no sortable data) and task cards
 * 2. Uses `pointerWithin` on columns first — if pointer is inside a column, use it
 * 3. Within the matched column, uses `closestCenter` on its task cards
 * 4. For empty columns, returns the column itself as the drop target
 * 5. Falls back to `rectIntersection` → `closestCenter` as last resort
 */
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const { droppableContainers, ...rest } = args;

  // Separate droppables into columns and task cards
  const columns = droppableContainers.filter(
    (container) => !container.data.current?.sortable
  );
  const taskCards = droppableContainers.filter(
    (container) => !!container.data.current?.sortable
  );

  // Step 1: Check which column the pointer is inside
  const columnCollisions = pointerWithin({
    ...rest,
    droppableContainers: columns,
  });

  const targetColumnId = getFirstCollision(columnCollisions, 'id');

  if (targetColumnId) {
    // Step 2: Find task cards that belong to this column
    const columnCards = taskCards.filter(
      (card) => card.data.current?.sortable?.containerId === targetColumnId
    );

    // Step 3: If column has cards, use closestCenter among them
    if (columnCards.length > 0) {
      const cardCollisions = closestCenter({
        ...rest,
        droppableContainers: columnCards,
      });

      if (cardCollisions.length > 0) {
        return cardCollisions;
      }
    }

    // Step 4: Empty column — return the column itself as drop target
    return columnCollisions;
  }

  // Step 5: Fallback — try rectIntersection on columns, then closestCenter on all
  const rectCollisions = rectIntersection({
    ...rest,
    droppableContainers: columns,
  });

  if (rectCollisions.length > 0) {
    return rectCollisions;
  }

  return closestCenter(args);
};
