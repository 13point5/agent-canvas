import { readLockfile } from "@agent-canvas/server";
import type {
  BoardMetadata,
  CreateShapesApiResponse,
  DeleteShapesApiResponse,
  GetShapesApiResponse,
  UpdateShapesApiResponse,
} from "@agent-canvas/shared";
import axios, { AxiosError } from "axios";

// ---------------------------------
// Error Classes
// ---------------------------------

export class ServerNotRunningError extends Error {
  constructor() {
    super(
      "agent-canvas server is not running.\nRun 'agent-canvas open' first, or start the dev server with 'bun run dev'.",
    );
    this.name = "ServerNotRunningError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getServerUrl(): string {
  // Check for environment variable override (useful for custom setups)
  const envUrl = process.env.AGENT_CANVAS_URL;
  if (envUrl) {
    return envUrl;
  }

  // Read lockfile (written by both production and dev servers)
  const lockfile = readLockfile();
  if (lockfile) {
    return lockfile.url;
  }

  throw new ServerNotRunningError();
}

// ---------------------------------
// HTTP Client
// ---------------------------------

function createClient() {
  const baseURL = getServerUrl();

  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function handleError(error: unknown): never {
  if (error instanceof ServerNotRunningError) {
    throw error;
  }

  if (error instanceof AxiosError) {
    const message = error.response?.data?.error || error.message;
    throw new ApiError(message, error.response?.status);
  }

  throw error;
}

// ---------------------------------
// Board API Functions
// ---------------------------------

export async function listBoards(): Promise<BoardMetadata[]> {
  try {
    const client = createClient();
    const response = await client.get<BoardMetadata[]>("/api/boards");

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export async function createBoard(name: string): Promise<BoardMetadata> {
  try {
    const client = createClient();
    const response = await client.post<BoardMetadata>("/api/boards", { name });

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export async function getBoard(id: string): Promise<BoardMetadata> {
  try {
    const client = createClient();
    const response = await client.get<BoardMetadata>(`/api/boards/${id}`);

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export async function updateBoard(
  id: string,
  name: string,
): Promise<BoardMetadata> {
  try {
    const client = createClient();
    const response = await client.patch<BoardMetadata>(`/api/boards/${id}`, {
      name,
    });

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export async function deleteBoard(id: string): Promise<void> {
  try {
    const client = createClient();

    await client.delete(`/api/boards/${id}`);
  } catch (error) {
    handleError(error);
  }
}

// ---------------------------------
// Health API
// ---------------------------------

export interface HealthResponse {
  status: string;
  clients: number;
}

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const client = createClient();
    const response = await client.get<HealthResponse>("/api/health");

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

// ---------------------------------
// Shapes API Functions
// ---------------------------------

export async function getBoardShapes(
  id: string,
): Promise<GetShapesApiResponse> {
  try {
    const client = createClient();
    const response = await client.get<GetShapesApiResponse>(
      `/api/boards/${id}/shapes`,
    );

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export async function createBoardShapes(
  id: string,
  shapes: unknown[],
): Promise<CreateShapesApiResponse> {
  try {
    const client = createClient();
    const response = await client.post<CreateShapesApiResponse>(
      `/api/boards/${id}/shapes`,
      { shapes },
    );

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export async function updateBoardShapes(
  id: string,
  shapes: unknown[],
): Promise<UpdateShapesApiResponse> {
  try {
    const client = createClient();
    const response = await client.patch<UpdateShapesApiResponse>(
      `/api/boards/${id}/shapes`,
      { shapes },
    );

    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export async function deleteBoardShapes(
  id: string,
  ids: string[],
): Promise<DeleteShapesApiResponse> {
  try {
    const client = createClient();
    const response = await client.delete<DeleteShapesApiResponse>(
      `/api/boards/${id}/shapes`,
      { data: { ids } },
    );

    return response.data;
  } catch (error) {
    handleError(error);
  }
}
