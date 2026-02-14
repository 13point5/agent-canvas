import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import type { FileBackedShape, FileBackedUpdateShape, InputShape, UpdateShape } from "@agent-canvas/shared";

export const isFileBackedInputShape = (shape: InputShape): shape is FileBackedShape =>
  shape.type === "markdown" || shape.type === "html";

export const isFileBackedUpdateShape = (shape: UpdateShape): shape is FileBackedUpdateShape =>
  shape.type === "markdown" || shape.type === "html";

type ResolveShapeContentOptions = {
  defaultMissingContent: boolean;
};

export const resolveShapeContentFromFile = async <T extends FileBackedShape | FileBackedUpdateShape>(
  shape: T,
  options: ResolveShapeContentOptions = { defaultMissingContent: true },
): Promise<T> => {
  const props = shape.props;
  const hasContent = typeof props?.content === "string" && props.content.length > 0;
  if (hasContent) {
    return shape;
  }

  const safeProps = props ?? {};
  const filePath = safeProps.filePath;
  if (typeof filePath !== "string" || !filePath) {
    if (!options.defaultMissingContent) {
      return shape;
    }

    return {
      ...shape,
      props: {
        ...safeProps,
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
    typeof safeProps.name === "string" && safeProps.name.trim()
      ? safeProps.name
      : basename(filePath).replace(/\.[^.]+$/, "");

  return {
    ...shape,
    props: {
      ...safeProps,
      content,
      name,
    },
  };
};
