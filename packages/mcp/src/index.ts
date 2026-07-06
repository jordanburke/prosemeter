/**
 * @prosemeter/mcp — the MCP server entry. Starts the somamcp server on stdio (the v1 transport).
 * The tool handlers and server factory are exported for embedding and testing.
 */

import process from "node:process"

import { createProsemeterServer } from "./server"

export {
  checkConvergenceHandler,
  compareBaselineHandler,
  listProfilesHandler,
  scoreFileHandler,
  scoreTextHandler,
  ToolError,
} from "./handlers"
export { createProsemeterServer } from "./server"
export { VERSION } from "./version"

export const main = async (): Promise<void> => {
  const server = createProsemeterServer()
  process.stderr.write("[prosemeter-mcp] starting in stdio mode\n")
  await server.start({ transportType: "stdio" })
}

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))
