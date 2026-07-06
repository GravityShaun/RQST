export function toCamelCase<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => toCamelCase(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value as T;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      toCamelCase(item),
    ]),
  ) as T;
}
