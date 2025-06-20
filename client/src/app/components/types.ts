export type CoreBase = {
    leftExternalBase: {
        name: string,
        externalTables: ExternalTable[]
        
    },
    rightExternalBase: {
        name: string,
        externalTables: ExternalTable[]
    }
}

export type ExternalTable = {
    name: string,
    id: string,
    externalColumns: ExternalColumn[]
}

export type ExternalColumn = {
    id: string;
    name: string;
}