import { describe, expect, it } from "vitest"

import { createProsemeterServer } from "../src/server"

describe("createProsemeterServer", () => {
  it("builds a server exposing the tool API", () => {
    const server = createProsemeterServer()
    expect(server).toBeDefined()
    expect(typeof server.addTool).toBe("function")
    expect(typeof server.start).toBe("function")
  })
})
