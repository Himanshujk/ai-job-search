import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers"

describe("cli flag validation", () => {
  test("detail with no id exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({ code: "NO_ID" })
  })

  test("search with an invalid --country exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "-q", "golang", "--country", "ZZ"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({ code: "BAD_COUNTRY" })
  })

  test("search with a non-numeric --jobage exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "-q", "golang", "--jobage", "soon"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({ code: "BAD_ARG" })
  })

  test("unknown command exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["frobnicate"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr)).toMatchObject({ code: "BAD_CMD" })
  })

  test("no command prints help and exits 1", async () => {
    const result = await runCLI([])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain("wearedevelopers-cli")
  })
})
