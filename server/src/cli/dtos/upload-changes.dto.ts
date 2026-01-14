export declare class CreateFileOperation {
  op?: 'create';
  // the filename of the file this update originated from, used to identify the file in the response for the CLI
  filename: string;
  // the content of the changes as key-value pairs
  data?: Record<string, unknown>;
}

export declare class UpdateFileOperation {
  op?: 'update';
  // the remote ID of the record that this file is linked to
  id: string;
  // the filename of the file this update originated from, used to identify the file in the response for the CLI
  filename: string;
  // the content of the changes as key-value pairs
  data?: Record<string, unknown>;
}

export declare class DeleteFileOperation {
  op?: 'delete';
  // the remote ID of the record that this file is linked to
  id: string;
  // the filename of the file this update originated from, used to identify the file in the response for the CLI
  filename: string;
}

export declare class UploadChangesDto {
  // The ID of the table to download, can be an array of IDs if the table is nested in a base or site
  // actual meaning depends on the connector
  tableId?: string[];

  creates?: CreateFileOperation[];
  updates?: UpdateFileOperation[];
  deletes?: DeleteFileOperation[];
}

export type ValidatedCreateFileOperation = Required<CreateFileOperation>;
export type ValidatedUpdateFileOperation = Required<UpdateFileOperation>;
export type ValidatedDeleteFileOperation = Required<DeleteFileOperation>;
export type ValidatedUploadChangesDto = UploadChangesDto;

export type UploadChangesResult = {
  op: 'create' | 'update' | 'delete';
  id: string;
  filename: string;
  error?: string;
};
export class UploadChangesResponseDto {
  results: UploadChangesResult[] = [];
}
