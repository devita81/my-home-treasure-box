// Retain the created ID before attaching: retries update, never insert again.
export async function saveWithDocuments<T>(options: {
  existingId: string | null;
  values: T;
  create: (values: T) => Promise<string>;
  update: (id: string, values: T) => Promise<void>;
  rememberId: (id: string) => void;
  attach: (id: string) => Promise<void>;
}) {
  let id = options.existingId;
  if (id) await options.update(id, options.values);
  else {
    id = await options.create(options.values);
    options.rememberId(id);
  }
  await options.attach(id);
  return id;
}