import { type RecordProps, T, type TLShape } from "tldraw";

const DB_SCHEMA_SHAPE_TYPE = "db-schema" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [DB_SCHEMA_SHAPE_TYPE]: {
      w: number;
      h: number;
      tableName: string;
      columns: string;
    };
  }
}

export type DbSchemaShape = TLShape<typeof DB_SCHEMA_SHAPE_TYPE>;

export const dbSchemaShapeProps: RecordProps<DbSchemaShape> = {
  w: T.number,
  h: T.number,
  tableName: T.string,
  columns: T.string,
};
