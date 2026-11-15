import { assert, assertEquals } from "jsr:@std/assert@1"
import { handleMailbox, type Deps } from "./handler.ts"
import { MailError } from "../_shared/mail.ts"

const good = { action: "save", host: "SMTP.Gmail.com", port: 465, security: "ssl", username: "acme@gmail.com", password: "abcd efgh ijkl mnop", from_name: "Acme Traders", from_email: "acme@gmail.com" }

function setup(tenantId = "tenant-1") {
  const calls = { verified: [] as any[], saved: [] as any[], removed: [] as string[] }
  const deps: Deps = {
    tenantFor: async (t) => (t === "good" ? { tenantId } : null),
    target: async (host) => ({ ip: "142.250.1.1", servername: host }),
    verify: async (cfg, pw) => { calls.verified.push({ cfg, pw }) },
    save: async (t, m, pw) => { calls.saved.push({ t, m, pw }) },
    remove: async (t) => { calls.removed.push(t) },
  }
  return { deps, calls }
}
const post = (body: unknown, token = "good") => new Request("http://x", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
const read = async (r: Response) => ({ status: r.status, text: await r.text() })

Deno.test("signed-out callers are refused", async () => {
  const { deps, calls } = setup()
  assertEquals((await read(await handleMailbox(post(good, "nope"), deps))).status, 401)
  assertEquals(calls.saved.length, 0)
})

Deno.test("a working mailbox is verified, then saved for the caller's own tenant, and the password is never echoed back", async () => {
  const { deps, calls } = setup()
  const r = await read(await handleMailbox(post({ ...good, tenant_id: "someone-else" }), deps))
  assertEquals(r.status, 200)
  assert(!r.text.includes("abcd"), "response must not contain the password")
  assertEquals(calls.verified[0].cfg.host, "142.250.1.1")
  assertEquals(calls.verified[0].cfg.servername, "smtp.gmail.com")
  assertEquals(calls.saved[0].t, "tenant-1")
  assertEquals(calls.saved[0].m.host, "smtp.gmail.com")
  assertEquals(calls.saved[0].pw, "abcd efgh ijkl mnop")
  assert(!("password" in calls.saved[0].m))
})

Deno.test("a mailbox whose login fails is not saved, and the reason is plain", async () => {
  const { deps, calls } = setup()
  deps.verify = async () => { throw new MailError("auth", "The mail server rejected the username or password.") }
  const r = await read(await handleMailbox(post(good), deps))
  assertEquals(r.status, 400)
  assert(r.text.includes("rejected the username"))
  assertEquals(calls.saved.length, 0)
})

Deno.test("private or invalid hosts are refused before any connection", async () => {
  const { deps, calls } = setup()
  deps.target = async () => { throw new MailError("host", "That server name points to a private address, so it can't be used.") }
  assertEquals((await read(await handleMailbox(post({ ...good, host: "internal.example.com" }), deps))).status, 400)
  assertEquals(calls.verified.length, 0)
  assertEquals(calls.saved.length, 0)
})

Deno.test("only standard sending ports and real settings are accepted", async () => {
  const { deps, calls } = setup()
  for (const bad of [{ port: 22 }, { port: 5432 }, { port: "abc" }, { security: "none" }, { username: "" }, { password: "" }, { from_email: "nope" }]) {
    assertEquals((await read(await handleMailbox(post({ ...good, ...bad }), deps))).status, 400, JSON.stringify(bad))
  }
  assertEquals(calls.saved.length, 0)
})

Deno.test("the demo workspace cannot connect a real mailbox", async () => {
  const { deps, calls } = setup("cape-fresh-grocery")
  assertEquals((await read(await handleMailbox(post(good), deps))).status, 400)
  assertEquals(calls.saved.length, 0)
})

Deno.test("disconnect removes the caller's mailbox and password", async () => {
  const { deps, calls } = setup()
  assertEquals((await read(await handleMailbox(post({ action: "disconnect" }), deps))).status, 200)
  assertEquals(calls.removed, ["tenant-1"])
})

Deno.test("unknown actions are rejected", async () => {
  const { deps } = setup()
  assertEquals((await read(await handleMailbox(post({ action: "dump" }), deps))).status, 400)
})
