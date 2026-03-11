import { appConfig } from "@/lib/server/config";
import { getAnalysisSession, registerReplay } from "@/lib/server/analysis-service";
import { sleep } from "@/lib/server/utils";

export const dynamic = "force-dynamic";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const session = await getAnalysisSession(id);
    await registerReplay(id);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(encodeSse("session", { session })));

        for (const message of session.messages) {
          controller.enqueue(encoder.encode(encodeSse("message", { message })));
          await sleep(appConfig.streamDelayMs);
        }

        controller.enqueue(
          encoder.encode(
            encodeSse("done", {
              id: session.id,
              completedAt: new Date().toISOString()
            })
          )
        );
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch {
    return new Response(encodeSse("error", { message: "세션을 찾을 수 없습니다." }), {
      status: 404,
      headers: {
        "Content-Type": "text/event-stream"
      }
    });
  }
}
