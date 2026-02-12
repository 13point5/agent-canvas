import type {
  CreateShapesRequest,
  CreateShapesResponse,
  DeleteShapesRequest,
  DeleteShapesResponse,
  GetShapesRequest,
  GetShapesResponse,
  UpdateShapesRequest,
  UpdateShapesResponse,
} from "@agent-canvas/shared";
import { useEffect } from "react";
import {
  AssetRecordType,
  type Editor,
  type TLShape,
  type TLShapeId,
  type VecLike,
  createShapeId,
  getSnapshot,
  toRichText,
} from "tldraw";
import { boardsMutations } from "@/api/client";
import { queryClient, queryKeys } from "@/api/queryClient";
import { useEditorStore } from "@/stores/editor-store";

export function useWebSocket() {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(url);

      ws.onerror = () => {};

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "get-shapes:request" && ws) {
            handleGetShapesRequest(ws, data as GetShapesRequest);
            return;
          }

          if (data.type === "create-shapes:request" && ws) {
            handleCreateShapesRequest(ws, data as CreateShapesRequest);
            return;
          }

          if (data.type === "update-shapes:request" && ws) {
            handleUpdateShapesRequest(ws, data as UpdateShapesRequest);
            return;
          }

          if (data.type === "delete-shapes:request" && ws) {
            handleDeleteShapesRequest(ws, data as DeleteShapesRequest);
            return;
          }

          if (
            data.type === "board:created" ||
            data.type === "board:updated" ||
            data.type === "board:deleted"
          ) {
            queryClient.invalidateQueries({ queryKey: queryKeys.boards });
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        ws = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    async function handleGetShapesRequest(
      ws: WebSocket,
      request: GetShapesRequest,
    ) {
      const { requestId, boardId } = request;
      try {
        const editor = await useEditorStore.getState().loadBoard(boardId);
        const shapes = editor.getCurrentPageShapesInReadingOrder();

        const response: GetShapesResponse = {
          type: "get-shapes:response",
          requestId,
          shapes,
        };
        ws.send(JSON.stringify(response));
      } catch (e) {
        const response: GetShapesResponse = {
          type: "get-shapes:response",
          requestId,
          shapes: null,
          error: e instanceof Error ? e.message : "Failed to load board",
        };
        ws.send(JSON.stringify(response));
      }
    }

    async function handleCreateShapesRequest(
      ws: WebSocket,
      request: CreateShapesRequest,
    ) {
      const { requestId, boardId, shapes: inputShapes } = request;
      try {
        let editor = await useEditorStore.getState().loadBoard(boardId);

        // Diagnostic: log registered shape utils
        console.log(
          "[ws] createShapes: registered shape utils:",
          Object.keys(editor.shapeUtils),
        );

        // Check all requested shape types are available in this editor
        const requestedTypes = new Set(
          inputShapes.map((s: Record<string, unknown>) => s.type as string),
        );
        const missingTypes = [...requestedTypes].filter(
          (t) => !editor.shapeUtils[t],
        );

        if (missingTypes.length > 0) {
          // Try force-reloading the editor to pick up any newly registered shape utils
          console.warn(
            "[ws] createShapes: missing shape utils:",
            missingTypes,
            "— forcing fresh editor",
          );
          editor = await useEditorStore.getState().loadBoard(boardId, true);

          // Re-check after reload
          const stillMissing = missingTypes.filter(
            (t) => !editor.shapeUtils[t],
          );
          if (stillMissing.length > 0) {
            // This client can't handle these shape types — silently skip
            // so another connected client can handle the request
            console.warn(
              "[ws] createShapes: still missing after reload:",
              stillMissing,
              "— skipping request",
            );
            return;
          }
        }

        // Step a: Build temp→real ID mapping and extract arrow metadata
        const idMap: Record<string, string> = {};
        const arrowMeta: Array<{
          realId: string;
          fromTempId?: string;
          toTempId?: string;
          x1: number;
          y1: number;
          x2: number;
          y2: number;
        }> = [];

        const shapesWithIds: Array<{
          input: Record<string, unknown>;
          realId: string;
          isArrow: boolean;
          isImage: boolean;
        }> = [];

        for (const rawShape of inputShapes) {
          const shape = rawShape as Record<string, unknown>;
          const realId = createShapeId();

          if (shape.tempId) {
            idMap[shape.tempId as string] = realId;
          }

          const isArrow =
            shape.type === "arrow" &&
            (shape.fromId !== undefined || shape.toId !== undefined);
          const isImage = shape.type === "image";

          if (isArrow) {
            arrowMeta.push({
              realId,
              fromTempId: shape.fromId as string | undefined,
              toTempId: shape.toId as string | undefined,
              x1: (shape.x1 as number) ?? 0,
              y1: (shape.y1 as number) ?? 0,
              x2: (shape.x2 as number) ?? 0,
              y2: (shape.y2 as number) ?? 0,
            });
          }

          shapesWithIds.push({ input: shape, realId, isArrow, isImage });
        }

        // Step b: Prepare shapes for TLDraw
        const preparedShapes: Record<string, unknown>[] = [];

        // Non-arrow shapes first (including images), then arrows (so targets exist when bindings are created)
        const sorted = [
          ...shapesWithIds.filter((s) => !s.isArrow),
          ...shapesWithIds.filter((s) => s.isArrow),
        ];

        for (const { input, realId, isArrow, isImage } of sorted) {
          // Strip custom fields
          const stripped = { ...input };
          delete stripped.tempId;
          delete stripped.fromId;
          delete stripped.toId;
          delete stripped.x1;
          delete stripped.y1;
          delete stripped.x2;
          delete stripped.y2;

          // Convert props.text (string) → props.richText for convenience
          const props = stripped.props as
            | Record<string, unknown>
            | undefined;
          if (props && typeof props.text === "string") {
            props.richText = toRichText(props.text as string);
            delete props.text;
          }

          if (isImage) {
            const assetId = AssetRecordType.createId();
            const imgProps = input.props as Record<string, unknown> | undefined;
            const w = (imgProps?.w as number) ?? 400;
            const h = (imgProps?.h as number) ?? 300;

            editor.createAssets([{
              id: assetId,
              type: "image",
              typeName: "asset",
              props: {
                name: (input.name as string) ?? "image",
                src: input.src as string,
                w,
                h,
                mimeType: (input.mimeType as string) ?? "image/png",
                isAnimated: (input.mimeType as string) === "image/gif",
              },
              meta: {},
            }]);

            // Strip image-specific fields from shape
            delete stripped.src;
            delete stripped.name;
            delete stripped.mimeType;

            preparedShapes.push({
              type: "image",
              id: realId,
              x: input.x as number,
              y: input.y as number,
              props: { assetId, w, h },
            });
          } else if (isArrow) {
            // Compute arrow position and start/end points
            const x1 = (input.x1 as number) ?? 0;
            const y1 = (input.y1 as number) ?? 0;
            const x2 = (input.x2 as number) ?? 0;
            const y2 = (input.y2 as number) ?? 0;
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);

            const props =
              (stripped.props as Record<string, unknown>) ?? {};
            preparedShapes.push({
              ...stripped,
              id: realId,
              x,
              y,
              props: {
                ...props,
                start: { x: x1 - x, y: y1 - y },
                end: { x: x2 - x, y: y2 - y },
              },
            });
          } else {
            preparedShapes.push({ ...stripped, id: realId });
          }
        }

        // Step c: Create shapes
        editor.createShapes(
          preparedShapes as Parameters<typeof editor.createShapes>[0],
        );

        // Step d: Create bindings for arrows
        for (const arrow of arrowMeta) {
          if (arrow.fromTempId) {
            const fromRealId = idMap[arrow.fromTempId] as TLShapeId;
            const fromShape = fromRealId
              ? editor.getShape(fromRealId)
              : undefined;
            if (fromShape) {
              const anchor = calculateArrowBindingAnchor(editor, fromShape, {
                x: arrow.x1,
                y: arrow.y1,
              });
              editor.createBinding({
                type: "arrow",
                fromId: arrow.realId as TLShapeId,
                toId: fromRealId,
                props: {
                  terminal: "start",
                  normalizedAnchor: anchor,
                  isExact: false,
                  isPrecise: true,
                },
                meta: {},
              });
            }
          }
          if (arrow.toTempId) {
            const toRealId = idMap[arrow.toTempId] as TLShapeId;
            const toShape = toRealId
              ? editor.getShape(toRealId)
              : undefined;
            if (toShape) {
              const anchor = calculateArrowBindingAnchor(editor, toShape, {
                x: arrow.x2,
                y: arrow.y2,
              });
              editor.createBinding({
                type: "arrow",
                fromId: arrow.realId as TLShapeId,
                toId: toRealId,
                props: {
                  terminal: "end",
                  normalizedAnchor: anchor,
                  isExact: false,
                  isPrecise: true,
                },
                meta: {},
              });
            }
          }
        }

        // Step e: Save and respond
        const createdIds = preparedShapes.map(
          (s) => s.id as string,
        );

        const snapshot = getSnapshot(editor.store);
        await boardsMutations.saveSnapshot({ id: boardId, snapshot });

        const hasIdMap = Object.keys(idMap).length > 0;

        const response: CreateShapesResponse = {
          type: "create-shapes:response",
          requestId,
          createdIds,
          ...(hasIdMap ? { idMap } : {}),
        };
        ws.send(JSON.stringify(response));
      } catch (e) {
        const response: CreateShapesResponse = {
          type: "create-shapes:response",
          requestId,
          createdIds: null,
          error: e instanceof Error ? e.message : "Failed to create shapes",
        };
        ws.send(JSON.stringify(response));
      }
    }

    async function handleUpdateShapesRequest(
      ws: WebSocket,
      request: UpdateShapesRequest,
    ) {
      const { requestId, boardId, shapes } = request;
      try {
        const editor = await useEditorStore.getState().loadBoard(boardId);

        const updates = shapes.map((shape) => {
          const { type, ...rest } = shape;
          const props = rest.props as Record<string, unknown> | undefined;
          if (props && typeof props.text === "string") {
            props.richText = toRichText(props.text as string);
            delete props.text;
          }
          return rest;
        });

        editor.updateShapes(
          updates as Parameters<typeof editor.updateShapes>[0],
        );

        const snapshot = getSnapshot(editor.store);
        await boardsMutations.saveSnapshot({ id: boardId, snapshot });

        const response: UpdateShapesResponse = {
          type: "update-shapes:response",
          requestId,
          updatedIds: shapes.map((s) => s.id),
        };
        ws.send(JSON.stringify(response));
      } catch (e) {
        const response: UpdateShapesResponse = {
          type: "update-shapes:response",
          requestId,
          updatedIds: null,
          error: e instanceof Error ? e.message : "Failed to update shapes",
        };
        ws.send(JSON.stringify(response));
      }
    }

    async function handleDeleteShapesRequest(
      ws: WebSocket,
      request: DeleteShapesRequest,
    ) {
      const { requestId, boardId, ids } = request;
      try {
        const editor = await useEditorStore.getState().loadBoard(boardId);

        editor.deleteShapes(ids as TLShapeId[]);

        const snapshot = getSnapshot(editor.store);
        await boardsMutations.saveSnapshot({ id: boardId, snapshot });

        const response: DeleteShapesResponse = {
          type: "delete-shapes:response",
          requestId,
          deletedIds: ids,
        };
        ws.send(JSON.stringify(response));
      } catch (e) {
        const response: DeleteShapesResponse = {
          type: "delete-shapes:response",
          requestId,
          deletedIds: null,
          error: e instanceof Error ? e.message : "Failed to delete shapes",
        };
        ws.send(JSON.stringify(response));
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);

      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);
}

function calculateArrowBindingAnchor(
  editor: Editor,
  targetShape: TLShape,
  targetPoint: VecLike,
): VecLike {
  const targetShapePageBounds = editor.getShapePageBounds(targetShape);
  const targetShapeGeometry = editor.getShapeGeometry(targetShape);

  if (!targetShapePageBounds || !targetShapeGeometry) {
    return { x: 0.5, y: 0.5 };
  }

  const pageTransform = editor.getShapePageTransform(targetShape);
  const targetShapeGeometryInPageSpace =
    targetShapeGeometry.transform(pageTransform);

  // If the target point is inside the shape, use it; otherwise use nearest point
  const anchorPoint = targetShapeGeometryInPageSpace.hitTestPoint(
    targetPoint,
    0,
    true,
  )
    ? targetPoint
    : targetShapeGeometryInPageSpace.nearestPoint(targetPoint);

  // Convert to normalized coordinates (0-1 range within shape bounds)
  const normalizedAnchor = {
    x: (anchorPoint.x - targetShapePageBounds.x) / targetShapePageBounds.w,
    y: (anchorPoint.y - targetShapePageBounds.y) / targetShapePageBounds.h,
  };

  // Clamp to [0.1, 0.9] range
  const clampedNormalizedAnchor = {
    x: Math.max(0.1, Math.min(0.9, normalizedAnchor.x)),
    y: Math.max(0.1, Math.min(0.9, normalizedAnchor.y)),
  };

  // Validate clamped point is still within geometry
  const clampedAnchorInPageSpace = {
    x:
      targetShapePageBounds.x +
      clampedNormalizedAnchor.x * targetShapePageBounds.w,
    y:
      targetShapePageBounds.y +
      clampedNormalizedAnchor.y * targetShapePageBounds.h,
  };

  return targetShapeGeometryInPageSpace.hitTestPoint(
    clampedAnchorInPageSpace,
    0,
    true,
  )
    ? clampedNormalizedAnchor
    : { x: 0.5, y: 0.5 };
}

