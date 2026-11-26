type StatefulClassName<State> = string | ((state: State) => string | undefined) | undefined;

export function addClassName(base: string, className: string | undefined): string;
export function addClassName<State>(base: string, className: StatefulClassName<State>): StatefulClassName<State>;
export function addClassName<State>(base: string, className: StatefulClassName<State>): StatefulClassName<State> {
  return typeof className === 'function'
    ? (state: State) => joinClassNames(base, className(state))
    : joinClassNames(base, className);
}

function joinClassNames(base: string, className: string | undefined): string {
  return className ? `${base} ${className}` : base;
}
