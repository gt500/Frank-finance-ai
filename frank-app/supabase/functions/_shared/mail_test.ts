import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1"
import { SMTPServer } from "npm:smtp-server@3.13.6"
import { simpleParser } from "npm:mailparser@3.7.1"
import { isPrivateAddress, safeTarget, friendlyMailError, sendMail, verifyMailbox, MailError } from "./mail.ts"

Deno.test("private, loopback, link-local and cloud-metadata addresses are recognised", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12::1", "::ffff:10.0.0.1"]) {
    assert(isPrivateAddress(ip), `${ip} should be private`)
  }
  for (const ip of ["8.8.8.8", "142.250.1.1", "172.32.0.1", "172.15.255.255", "2607:f8b0:4004::1"]) assert(!isPrivateAddress(ip), `${ip} should be public`)
})

const publicResolver = (ips: string[]) => async () => ips
Deno.test("safeTarget accepts a public hostname and returns the address to connect to", async () => {
  assertEquals(await safeTarget("smtp.gmail.com", publicResolver(["142.250.1.1"])), { ip: "142.250.1.1", servername: "smtp.gmail.com" })
})
Deno.test("safeTarget rejects localhost, IP literals, odd names and names that resolve to private addresses", async () => {
  for (const host of ["localhost", "127.0.0.1", "10.0.0.5", "[::1]", "metadata.google.internal.", "mail", "a b.com", "smtp.example.com:25", ""]) {
    await assertRejects(() => safeTarget(host, publicResolver(["142.250.1.1"])), MailError, undefined, `should reject ${JSON.stringify(host)}`)
  }
  await assertRejects(() => safeTarget("evil.example.com", publicResolver(["142.250.1.1", "10.0.0.5"])), MailError)
  await assertRejects(() => safeTarget("nxdomain.example.com", publicResolver([])), MailError)
})

Deno.test("mail errors become plain sentences without server detail", () => {
  assertEquals(friendlyMailError({ code: "EAUTH", message: "534-5.7.9 secret detail" }).code, "auth")
  assert(friendlyMailError({ code: "EAUTH" }).message.includes("app password"))
  assertEquals(friendlyMailError({ code: "ECONNECTION" }).code, "connect")
  assertEquals(friendlyMailError({ code: "ETIMEDOUT" }).code, "connect")
  assertEquals(friendlyMailError({ code: "EENVELOPE" }).code, "rejected")
  assertEquals(friendlyMailError({ responseCode: 550 }).code, "rejected")
  assertEquals(friendlyMailError(new Error("boom")).code, "unknown")
  assert(!friendlyMailError({ code: "EAUTH", message: "534-5.7.9 secret detail" }).message.includes("secret detail"))
})

// A real SMTP server on this machine (self-signed STARTTLS) — proves auth, addressing and the PDF attachment.
async function withServer<T>(user: string, pass: string, fn: (port: number, got: Promise<any>) => Promise<T>) {
  let resolveMail!: (m: unknown) => void
  const got = new Promise((r) => (resolveMail = r))
  const server = new SMTPServer({
    authOptional: false, disabledCommands: [],
    onAuth(a: any, _s: unknown, cb: any) { a.username === user && a.password === pass ? cb(null, { user }) : cb(new Error("Invalid login")) },
    onData(stream: any, _s: unknown, cb: any) { simpleParser(stream).then((m: unknown) => { resolveMail(m); cb() }) },
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  const port = (server.server.address() as { port: number }).port
  try { return await fn(port, got) } finally { await new Promise((r) => server.close(r)) }
}
const cfg = (port: number, over = {}) => ({ host: "127.0.0.1", servername: "localhost", port, security: "starttls" as const, username: "u@x.co", from_name: "Cape Fresh Grocery", from_email: "u@x.co", tlsOptions: { rejectUnauthorized: false }, ...over })

Deno.test("sends the PDF from the client's mailbox to the one customer address", async () => {
  await withServer("u@x.co", "right-pass", async (port, got) => {
    await sendMail(cfg(port), "right-pass", {
      to: "accounts@durbanvillecatering.co.za", subject: "Tax invoice INV-0047 from Cape Fresh Grocery", text: "Hi",
      attachments: [{ filename: "INV-0047.pdf", content: new TextEncoder().encode("%PDF-1.7 fake"), contentType: "application/pdf" }],
    })
    const m: any = await got
    assertEquals(m.subject, "Tax invoice INV-0047 from Cape Fresh Grocery")
    assertEquals(m.to.value.map((a: any) => a.address), ["accounts@durbanvillecatering.co.za"])
    assertEquals(m.from.value[0], { address: "u@x.co", name: "Cape Fresh Grocery" })
    assertEquals(m.attachments.length, 1)
    assertEquals(m.attachments[0].filename, "INV-0047.pdf")
    assert(m.attachments[0].content.toString().startsWith("%PDF"))
  })
})

Deno.test("verify passes with the right password and fails as 'auth' with the wrong one", async () => {
  await withServer("u@x.co", "right-pass", async (port) => {
    await verifyMailbox(cfg(port), "right-pass")
    const err = await assertRejects(() => verifyMailbox(cfg(port), "wrong"), MailError)
    assertEquals(err.code, "auth")
  })
})

Deno.test("an unreachable server is reported as 'connect'", async () => {
  const err = await assertRejects(() => verifyMailbox(cfg(1, { host: "127.0.0.1" }), "x"), MailError)
  assertEquals(err.code, "connect")
})
