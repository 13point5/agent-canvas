import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import type { FileBackedShape, FileBackedUpdateShape, InputShape, UpdateShape } from "@agent-canvas/shared";

export const isFileBackedInputShape = (shape: InputShape): shape is FileBackedShape =>
  shape.type === "markdown" || shape.type === "html";

export const isFileBackedUpdateShape = (shape: UpdateShape): shape is FileBackedUpdateShape =>
  shape.type === "markdown" || shape.type === "html";

export const resolveShapeContentFromFile = async <T extends FileBackedShape | FileBackedUpdateShape>(
  shape: T,
): Promise<T> => {
  if (typeof shape.props?.content === "string") {
    return shape;
  }

  const props = shape.props ?? {};
  const filePath = props.filePath;
  if (typeof filePath !== "string" || !filePath) {
    return {
      ...shape,
      props: {
        ...props,
        content: "",
      },
    };
  }

  if (!isAbsolute(filePath)) {
    throw new Error(`filePath must be absolute: ${filePath}`);
  }
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, "utf-8");
  const name =
    typeof props.name === "string" && props.name.trim() ? props.name : basename(filePath).replace(/\.[^.]+$/, "");

  return {
    ...shape,
    props: {
      ...props,
      content,
      name,
    },
  };
};
