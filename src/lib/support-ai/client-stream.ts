export type SupportStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

/** Splits our SSE (`data: {json}\n\n`) into events; returns the leftover buffer. */
export function drainSupportEvents(buffer: string): { events: SupportStreamEvent[]; rest: string } {
  const events: SupportStreamEvent[] = [];
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim()) as SupportStreamEvent;
        if (ev && typeof ev === "object" && "type" in ev) events.push(ev);
      } catch {
        // ignore malformed line
      }
    }
  }
  return { events, rest };
}
