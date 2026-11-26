export type PageWatchHandlers = {
  readonly onStylesheetsChanged: () => void;
  readonly onPageChanged: () => void;
};

export type PageWatch = {
  stop(): void;
  ignoringOwnWrites<T>(write: () => T): T;
};

type AttributeBefore = {
  readonly element: Element;
  readonly namespace: string | null;
  readonly name: string;
  readonly value: string | null;
};

const SETTLE_DELAY_MS = 50;
const STYLESHEET_RELATION = 'stylesheet';
const MEDIA_CONDITION = /^@media /;

export function watchPage({ onStylesheetsChanged, onPageChanged }: PageWatchHandlers): PageWatch {
  let pending: ReturnType<typeof setTimeout> | undefined;
  let stylesheetsChanged = false;
  const reportStylesheets = () => {
    if (stylesheetsChanged) return;
    stylesheetsChanged = true;
    queueMicrotask(() => {
      stylesheetsChanged = false;
      onStylesheetsChanged();
    });
  };
  const handle = (records: readonly MutationRecord[]) => {
    watchStylesheets(records, reportStylesheets);
    if (!changesPage(records)) return;
    clearTimeout(pending);
    pending = setTimeout(onPageChanged, SETTLE_DELAY_MS);
  };
  const observer = new MutationObserver(handle);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeOldValue: true,
    childList: true,
    subtree: true,
  });
  return {
    stop: () => {
      clearTimeout(pending);
      observer.disconnect();
    },
    ignoringOwnWrites: (write) => {
      handle(observer.takeRecords());
      try {
        return write();
      } finally {
        observer.takeRecords();
      }
    },
  };
}

export function watchMediaConditions(conditions: readonly string[], onChange: () => void): () => void {
  const queries = new Set(
    conditions
      .filter((condition) => MEDIA_CONDITION.test(condition))
      .map((condition) => condition.replace(MEDIA_CONDITION, ''))
  );
  const lists = [...queries].map((query) => matchMedia(query));
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}

function changesPage(records: readonly MutationRecord[]): boolean {
  if (records.some((record) => record.type !== 'attributes')) return true;
  return attributesBefore(records).some(
    ({ element, namespace, name, value }) => element.getAttributeNS(namespace, name) !== value
  );
}

function attributesBefore(records: readonly MutationRecord[]): readonly AttributeBefore[] {
  const firstByElement = new Map<Element, Map<string, AttributeBefore>>();
  for (const { target, attributeNamespace: namespace, attributeName: name, oldValue: value } of records) {
    if (!(target instanceof Element) || name === null) continue;
    const first = firstByElement.get(target) ?? new Map<string, AttributeBefore>();
    firstByElement.set(target, first);
    const key = `${namespace ?? ''} ${name}`;
    if (!first.has(key)) first.set(key, { element: target, namespace, name, value });
  }
  return [...firstByElement.values()].flatMap((first) => [...first.values()]);
}

function watchStylesheets(records: readonly MutationRecord[], onChanged: () => void): void {
  const added = records.flatMap((record) => [...record.addedNodes]);
  const removed = records.flatMap((record) => [...record.removedNodes]);
  for (const link of added.filter(isStylesheetLink)) link.addEventListener('load', onChanged, { once: true });
  if (added.some(isStyleElement) || removed.some((node) => isStyleElement(node) || isStylesheetLink(node))) onChanged();
}

function isStylesheetLink(node: Node): node is HTMLLinkElement {
  return node instanceof HTMLLinkElement && node.relList.contains(STYLESHEET_RELATION);
}

function isStyleElement(node: Node): node is HTMLStyleElement {
  return node instanceof HTMLStyleElement;
}
