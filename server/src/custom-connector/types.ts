export interface MappingField {
  path: string;
  type: string;
  name: string;
}

export interface MappingConfig {
  recordArrayPath: string;
  idPath?: string;
  fields: MappingField[];
}
