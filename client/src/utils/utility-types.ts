/** Mark one or more optional properties as required. */
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;
