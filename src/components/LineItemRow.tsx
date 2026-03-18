import { useFieldArray, type Control } from 'react-hook-form';
import { HOUR_OPTIONS, MINUTE_OPTIONS, TASK_CATEGORIES } from '../constants';
import type { CaseFormValues } from '../types';

interface LineItemRowProps {
  control: Control<CaseFormValues>;
  index: number;
  remove: (index: number) => void;
}

export function LineItemRow({ control, index, remove }: LineItemRowProps) {
  const { fields, append: appendTask, remove: removeTask } = useFieldArray({
    control,
    name: `lineItems.${index}.tasks`,
  });

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;

    if (TASK_CATEGORIES[value as keyof typeof TASK_CATEGORIES]) {
      appendTask({ category: value, subTask: undefined });
    } else {
      let foundCategory = '';
      for (const [cat, subTasks] of Object.entries(TASK_CATEGORIES)) {
        if (subTasks.includes(value)) {
          foundCategory = cat;
          break;
        }
      }
      if (foundCategory) {
        appendTask({ category: foundCategory, subTask: value });
      } else {
        appendTask({ category: 'Other', subTask: value });
      }
    }
    e.target.value = '';
  };

  return (
    <div className="line-item-row">
      <div className="tasks-section">
        <input
          type="date"
          style={{ width: '130px', marginBottom: '8px' }}
          {...control.register(`lineItems.${index}.date`)}
        />
        {fields.map((taskField, taskIndex) => (
          <div key={taskField.id} className="task-item">
            <span>
              {taskField.category} {taskField.subTask ? `- ${taskField.subTask}` : ''}
            </span>
            <button type="button" className="remove-task-btn" onClick={() => removeTask(taskIndex)}>
              ×
            </button>
          </div>
        ))}
        <select onChange={handleCategorySelect} defaultValue="" style={{ width: 'max-content', marginTop: '4px' }}>
          <option value="" disabled>+ Add task</option>
          {Object.entries(TASK_CATEGORIES).map(([category, subTasks]) => (
            <optgroup key={category} label={category}>
              <option value={category}>{category} (All)</option>
              {subTasks.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="input-col">
        <select {...control.register(`lineItems.${index}.hours`, { valueAsNumber: true })}>
          {HOUR_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>{hour}</option>
          ))}
        </select>
      </div>
      
      <div className="input-col">
        <select {...control.register(`lineItems.${index}.minutes`, { valueAsNumber: true })}>
          {MINUTE_OPTIONS.map((minute) => (
            <option key={minute} value={minute}>{minute}</option>
          ))}
        </select>
      </div>

      <div className="action-col" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end'}}>
        <button type="button" className="remove-row-btn" onClick={() => remove(index)} title="Remove row">
          🗑
        </button>
      </div>
    </div>
  );
}
