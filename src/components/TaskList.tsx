import { motion } from 'motion/react';
import { TASKS, tasksDone, type TaskLine } from '../lib/voyage';

/** Lista de tarefas da viagem, com barra geral. */
export function TaskList({ lines }: { lines: readonly TaskLine[] }) {
  const { done, total } = tasksDone(lines);
  return (
    <div className="task-panel glass">
      <div className="task-bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Tarefas concluídas">
        <motion.div initial={false} animate={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      {lines.map((line) => {
        const ok = line.done >= line.total;
        return (
          <div key={line.kind} className={`task-row${ok ? ' done' : ''}`}>
            <span aria-hidden="true">{ok ? '✅' : TASKS[line.kind].emoji}</span>
            <span>{TASKS[line.kind].title}</span>
            <span className="count">
              {line.done}/{line.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
