import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import type { AgentStep } from '../data/agent-steps';
import styles from './AgentSteps.module.scss';

interface Props {
  steps: readonly AgentStep[];
}

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true once React runs in the browser.
 * The server render is the no-JavaScript fallback, so this is what switches to tabs.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function StepBody({ step }: { step: AgentStep }) {
  return (
    <div className={styles.body}>
      <div className={styles.part}>
        <h4 className={styles.label}>The prompt</h4>
        <pre className={styles.prompt}>
          <code>{step.prompt}</code>
        </pre>
      </div>
      <div className={styles.part}>
        <h4 className={styles.label}>What worked</h4>
        <p>{step.worked}</p>
      </div>
      <div className={styles.part}>
        <h4 className={styles.label}>What I changed</h4>
        <p>{step.changed}</p>
      </div>
    </div>
  );
}

export default function AgentSteps({ steps }: Props) {
  const hydrated = useHydrated();
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const last = steps.length - 1;

  if (!hydrated) {
    return (
      <ol className={styles.list}>
        {steps.map((step, index) => (
          <li key={step.id} className={styles.listItem}>
            <h3 className={styles.stepTitle}>
              <span className={styles.stepNumber}>{pad(index + 1)}</span> {step.title}
            </h3>
            <StepBody step={step} />
          </li>
        ))}
      </ol>
    );
  }

  const select = (index: number, moveFocus: boolean) => {
    setSelected(index);
    if (moveFocus) tabs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = target[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  };

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label="Build steps" className={styles.tablist}>
        {steps.map((step, index) => (
          <button
            key={step.id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            id={`${baseId}-tab-${step.id}`}
            type="button"
            role="tab"
            aria-selected={index === selected}
            aria-controls={`${baseId}-panel-${step.id}`}
            tabIndex={index === selected ? 0 : -1}
            className={styles.tab}
            onClick={() => {
              select(index, false);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            <span className={styles.tabNumber}>{pad(index + 1)}</span>
            <span className={styles.tabTitle}>{step.title}</span>
          </button>
        ))}
      </div>

      {steps.map((step, index) => (
        <div
          key={step.id}
          id={`${baseId}-panel-${step.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${step.id}`}
          hidden={index !== selected}
          tabIndex={0}
          className={styles.panel}
        >
          <h3 className={styles.stepTitle}>
            <span className={styles.stepNumber}>
              Step {index + 1} of {steps.length}
            </span>{' '}
            {step.title}
          </h3>
          <StepBody step={step} />
          {/* These buttons hide their own panel, so focus moves to the newly selected tab. */}
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerButton}
              disabled={index === 0}
              onClick={() => {
                select(index - 1, true);
              }}
            >
              Previous step
            </button>
            <button
              type="button"
              className={styles.pagerButton}
              disabled={index === last}
              onClick={() => {
                select(index + 1, true);
              }}
            >
              Next step
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
