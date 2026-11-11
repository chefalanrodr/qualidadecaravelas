import { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type Item = { id: string };

export function SortableList<T extends Item>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {items.map((it) => (
            <SortableRow key={it.id} id={it.id} render={renderItem} item={it} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow<T extends Item>({
  id,
  item,
  render,
}: {
  id: string;
  item: T;
  render: (item: T, handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : ("auto" as const),
  };
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground min-h-11 min-w-8 grid place-items-center"
      aria-label="Arrastar para reordenar"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {render(item, handle)}
    </div>
  );
}
