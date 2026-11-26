type ClassNamePart = string | false | null | undefined;

function classNames(...parts: ClassNamePart[]): string {
  return parts.filter(Boolean).join(' ');
}

export { classNames };
