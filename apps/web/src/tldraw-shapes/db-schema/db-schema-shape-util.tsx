import { Fragment } from "react";
import { BaseBoxShapeUtil, getIndices, HTMLContainer, type TLHandle } from "tldraw";
import type { DbSchemaShape } from "./db-schema-shape-props";
import { dbSchemaShapeProps } from "./db-schema-shape-props";

const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 30;

type ParsedColumn = {
  name: string;
  type: string;
  comment: string;
};

function parseColumns(raw: string): ParsedColumn[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, comment = ""] = line.split("#");
      const [name = "", type = ""] = left.split(":");
      return {
        name: name.trim(),
        type: type.trim(),
        comment: comment.trim(),
      };
    });
}

export class DbSchemaShapeUtil extends BaseBoxShapeUtil<DbSchemaShape> {
  static override type = "db-schema" as const;
  static override props = dbSchemaShapeProps;

  override getDefaultProps(): DbSchemaShape["props"] {
    const columns = [
      "id: uuid #primary key",
      "name: varchar(255) #display name",
      "created_at: timestamptz #creation timestamp",
    ].join("\n");

    return {
      w: 460,
      h: 220,
      tableName: "new_table",
      columns,
    };
  }

  override canEdit() {
    return true;
  }

  override canResize() {
    return true;
  }

  override canBind() {
    return true;
  }

  override getHandles(shape: DbSchemaShape): TLHandle[] {
    const columns = parseColumns(shape.props.columns);
    const indices = getIndices(columns.length * 2 + 2);
    const rowHandles = columns.flatMap((_, index) => {
      const y = HEADER_HEIGHT + ROW_HEIGHT * index + ROW_HEIGHT / 2;
      return [
        {
          id: `col-${index}-left`,
          type: "vertex" as const,
          index: indices[index * 2 + 2],
          x: 0,
          y,
        },
        {
          id: `col-${index}-right`,
          type: "vertex" as const,
          index: indices[index * 2 + 3],
          x: shape.props.w,
          y,
        },
      ];
    });

    return [
      { id: "table-top", type: "vertex", index: indices[0], x: shape.props.w / 2, y: 0 },
      {
        id: "table-bottom",
        type: "vertex",
        index: indices[1],
        x: shape.props.w / 2,
        y: shape.props.h,
      },
      ...rowHandles,
    ];
  }

  override component(shape: DbSchemaShape) {
    const columns = parseColumns(shape.props.columns);

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          border: "1px solid #334155",
          borderRadius: 10,
          overflow: "hidden",
          background: "#0f172a",
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
        }}
      >
        <div
          style={{
            height: HEADER_HEIGHT,
            background: "#1e293b",
            borderBottom: "1px solid #334155",
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {shape.props.tableName || "table"}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.4fr", overflow: "hidden" }}
        >
          {columns.map((column, index) => (
            <Fragment key={index}>
              <div
                key={`name-${index}`}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid #1e293b",
                  padding: "0 12px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {column.name}
              </div>
              <div
                key={`type-${index}`}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid #1e293b",
                  padding: "0 12px",
                  display: "flex",
                  alignItems: "center",
                  color: "#93c5fd",
                }}
              >
                {column.type}
              </div>
              <div
                key={`comment-${index}`}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid #1e293b",
                  padding: "0 12px",
                  display: "flex",
                  alignItems: "center",
                  color: "#94a3b8",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {column.comment ? `// ${column.comment}` : ""}
              </div>
            </Fragment>
          ))}
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: DbSchemaShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={10} ry={10} />;
  }
}
