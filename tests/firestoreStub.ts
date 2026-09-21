// Isolated service tests: no network, credentials, or production data.
export const records = new Map<string, Record<string, any>>();
let sequence = 0;
export class Timestamp {
  constructor(private date: Date) {}
  static fromDate(date: Date) { return new Timestamp(date); }
  toDate() { return this.date; }
}
export const serverTimestamp = () => Timestamp.fromDate(new Date());
export const collection = (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') });
export const doc = (base: any, ...parts: string[]) => {
  const path = base.path ? `${base.path}/${parts.join('/') || `generated-${++sequence}`}` : parts.join('/');
  return { path, id: path.split('/').pop()! };
};
const snapshot = (path: string, value?: Record<string, any>) => ({ id: path.split('/').pop()!, ref: { path }, data: () => value, exists: () => Boolean(value) });
export const getDoc = async (ref: { path: string }) => snapshot(ref.path, records.get(ref.path));
export const where = (field: string, operator: string, value: unknown) => ({ field, operator, value });
export const query = (ref: any, ...constraints: any[]) => ({ ...ref, constraints });
export const getDocs = async (ref: any) => {
  const docs = [...records].filter(([path, data]) => {
    if (path.split('/').slice(0, -1).join('/') !== ref.path) return false;
    return (ref.constraints ?? []).every((filter: any) => filter.operator === 'array-contains'
      ? data[filter.field]?.includes(filter.value) : data[filter.field] === filter.value);
  }).map(([path, value]) => snapshot(path, value));
  return { docs, size: docs.length, empty: docs.length === 0 };
};
export const updateDoc = async (ref: { path: string }, data: any) => {
  if (!records.has(ref.path)) throw new Error('Missing fixture');
  records.set(ref.path, { ...records.get(ref.path), ...data });
};
export const setDoc = async (ref: { path: string }, data: any) => { records.set(ref.path, data); };
export const deleteDoc = async (ref: { path: string }) => { records.delete(ref.path); };
export const writeBatch = () => {
  const writes: Array<() => Promise<void>> = [];
  return { update: (ref: any, data: any) => writes.push(() => updateDoc(ref, data)), commit: () => Promise.all(writes.map((write) => write())) };
};
