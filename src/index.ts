import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { pipeline, getEnv } from "@supabase/middleware";
import { withOAuthProtectedResource, fromSupabaseUrl } from "@supabase/server";

function createServer(env: Env) {
  console.log("EDUNEX DEBUG: add registered");
  const server = new McpServer({
    name: "EduNex Forms",
    version: "1.0.0",
  });

  server.registerTool(
    "add",
    {
      description: "Събира две числа.",
      inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    })
  );
  console.log("EDUNEX DEBUG: createServer started");

  server.registerTool(
    "calculate",
    {
      description: "Извършва събиране, изваждане, умножение или деление.",
      inputSchema: {
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number(),
        b: z.number(),
      },
    },
    async ({ operation, a, b }) => {
      let result: number;

      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            return {
              isError: true,
              content: [{ type: "text", text: "Грешка: делението на нула не е позволено." }],
            };
          }
          result = a / b;
          break;
      }

      return {
        content: [{ type: "text", text: String(result) }],
      };
    }
  );
  console.log("EDUNEX DEBUG: calculate registered");


  server.registerTool(
    "create_form",
    {
      description:
        "Създава Google Form със заглавие, описание и списък от текстови въпроси. Връща линкове за попълване и редактиране.",
      inputSchema: {
        title: z.string().describe("Заглавие на формуляра"),
        description: z.string().describe("Описание на формуляра"),
        questions: z.array(z.string()).describe("Списък от въпроси, всеки като отделен текст"),
      },
    },
    async ({ title, description, questions }) => {
      try {
        const response = await fetch(env.GOOGLE_APPS_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            secret: env.GOOGLE_APPS_SCRIPT_SECRET,
            title,
            description,
            questions,
          }),
        });

        const responseText = await response.text();

        console.log("GOOGLE APPS SCRIPT STATUS:", response.status);
        console.log("GOOGLE APPS SCRIPT RESPONSE:", responseText.slice(0, 1000));

        let result;

        try {
          result = JSON.parse(responseText);
        } catch {
          return {
            isError: true,
            content: [{
              type: "text",
              text: "Google Apps Script върна невалиден JSON. HTTP: " + response.status,
            }],
          };
        }

        if (!response.ok || !result.success) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: "Неуспешно създаване: " + (result.error || `HTTP ${response.status}`),
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              title: result.title,
              formUrl: result.formUrl,
              editUrl: result.editUrl,
            }),
          }],
        };
      } catch (error) {
        console.log(
          "GOOGLE APPS SCRIPT FETCH ERROR:",
          error instanceof Error ? error.message : String(error)
        );

        return {
          isError: true,
          content: [{
            type: "text",
            text: "Грешка при заявката: " +
              (error instanceof Error ? error.message : String(error)),
          }],
        };
      }
    }
  );

  console.log("EDUNEX DEBUG: create_form registered");
  return server;
}
  
  export default {
  fetch: pipeline(
    [
      withOAuthProtectedResource({
        resourceServer: (req) =>
          new URL("/mcp", new URL(req.url).origin).toString(),
        authorizationServer: fromSupabaseUrl(
          "https://ccybejxaaquwndxeolkc.supabase.co"
        ),
      }),
    ],
    async (request, _pipelineContext) => {
      const scriptUrl = getEnv("GOOGLE_APPS_SCRIPT_URL");
      const scriptSecret = getEnv("GOOGLE_APPS_SCRIPT_SECRET");

      console.log(
        "EDUNEX ENV CHECK:",
        JSON.stringify({
          urlExists: Boolean(scriptUrl),
          secretExists: Boolean(scriptSecret),
        })
      );

      if (!scriptUrl || !scriptSecret) {
        return new Response(
          "Missing Google Apps Script environment variables",
          { status: 500 }
        );
      }

      const workerEnv = {
        GOOGLE_APPS_SCRIPT_URL: scriptUrl,
        GOOGLE_APPS_SCRIPT_SECRET: scriptSecret,
      };

      console.log("EDUNEX: MCP HANDLER REACHED");

      const parsedBody =
        request.method === "POST"
          ? await request.clone().json()
          : undefined;

      const handler = createMcpHandler(() =>
        createServer(workerEnv)
      );

      const response = await handler.fetch(request, {
        parsedBody,
      });

      console.log("EDUNEX MCP STATUS:", response.status);
      console.log(
        "EDUNEX MCP RESPONSE:",
        await response.clone().text()
      );

      return response;
    }
  ),
};
