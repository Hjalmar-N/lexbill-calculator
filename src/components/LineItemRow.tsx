import { useFieldArray, type Control } from 'react-hook-form';
import { HOUR_OPTIONS, MINUTE_OPTIONS, TASK_CATEGORIES } from '../constants';
import type { CaseFormValues } from '../types';

const arrowBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '0.65rem',
  color: '#888',
  cursor: 'pointer',
  padding: '0 2px',
  lineHeight: 1,
};

interface LineItemRowProps {
  control: Control<CaseFormValues>;
  index: number;
  remove: (index: number) => void;
  totalItems: number;
  swapItems: (indexA: number, indexB: number) => void;
}

export function LineItemRow({ control, index, remove, totalItems, swapItems }: LineItemRowProps) {
  const { fields, append: appendTask, remove: removeTask, swap: swapTask } = useFieldArray({
    control,
    name: `lineItems.${index}.tasks`,
  });

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;

    if (value === '__MANUAL__') {
      appendTask({ category: 'Manual', manualText: '' });
      e.target.value = '';
      return;
    }

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
            {taskField.category === 'Manual' ? (
              <input
                type="text"
                placeholder="General Legal Work"
                {...control.register(`lineItems.${index}.tasks.${taskIndex}.manualText`)}
                style={{ border: 'none', background: 'transparent', padding: 0, fontSize: '0.85rem', color: '#444', flex: 1, minHeight: 'auto' }}
              />
            ) : (
              <span>
                {taskField.subTask || taskField.category}
              </span>
            )}
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
              {taskIndex > 0 && (
                <button type="button" style={arrowBtnStyle} onClick={() => swapTask(taskIndex, taskIndex - 1)} title="Move up">▲</button>
              )}
              {taskIndex < fields.length - 1 && (
                <button type="button" style={arrowBtnStyle} onClick={() => swapTask(taskIndex, taskIndex + 1)} title="Move down">▼</button>
              )}
              <button type="button" className="remove-task-btn" onClick={() => removeTask(taskIndex)}>×</button>
            </div>
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
          <option value="__MANUAL__">✎ Manual entry</option>
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

      <div className="action-col" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {index > 0 && (
            <button type="button" style={arrowBtnStyle} onClick={() => swapItems(index, index - 1)} title="Move row up">▲</button>
          )}
          {index < totalItems - 1 && (
            <button type="button" style={arrowBtnStyle} onClick={() => swapItems(index, index + 1)} title="Move row down">▼</button>
          )}
        </div>
        <button type="button" className="remove-row-btn" onClick={() => remove(index)} title="Remove row">
          🗑
        </button>
      </div>
    </div>
  );
}
