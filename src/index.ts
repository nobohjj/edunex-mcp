import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { pipeline } from "@supabase/middleware";
import {
  withOAuthProtectedResource,
  withSupabase,
  fromSupabaseUrl,
} from "@supabase/server";

function createServer(env: Env) {
  const server = new McpServer({
    name: "EduNex Forms",
    version: "1.0.0",
  });

  // TOOL 1: ADD
  server.registerTool(
    "add",
    {
      description: "Събира две числа.",
      inputSchema: {
        a: z.number(),
        b: z.number(),
      },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    })
  );

  // TOOL 2: CALCULATE
  server.registerTool(
    "calculate",
    {
      description: "Извършва събиране, изваждане, умножение или деление.",
      inputSchema: {
        operation: z.enum([
          "add",
          "subtract",
          "multiply",
          "divide",
        ]),
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
              content: [{
                type: "text",
                text: "Грешка: делението на нула не е позволено.",
              }],
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

  // TOOL 3: CREATE GOOGLE FORM
  server.registerTool(
    "create_form",
    {
      description:
        "Създава Google Form със заглавие, описание и списък от текстови въпроси. Връща линкове за попълване и редактиране.",
      inputSchema: {
        title: z.string().describe("Заглавие на формуляра"),
        description: z.string().describe("Описание на формуляра"),
        questions: z.array(z.string()).describe(
          "Списък от въпроси, всеки като отделен текст"
        ),
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

        const result = await response.json() as {
          success?: boolean;
          title?: string;
          formUrl?: string;
          editUrl?: string;
          error?: string;
        };

        if (!response.ok || !result.success) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: "Неуспешно създаване на формуляра: " +
                (result.error || `HTTP ${response.status}`),
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
      } catch {
        return {
          isError: true,
          content: [{
            type: "text",
            text: "Неуспешна връзка с Google Apps Script API.",
          }],
        };
      }
    }
  );

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
      withSupabase({
        auth: "user",
        env: {
          SUPABASE_URL: "https://ccybejxaaquwndxeolkc.supabase.co",
          SUPABASE_PUBLISHABLE_KEY:
            "sb_publishable_zGf9nSxAtWqucmvRG2Zbww_TKCDv5ik",
        },
      }),
    ],
    async (request, env, ctx) => {
      const handler = createMcpHandler(() => createServer(env));
      return handler(request, env, ctx);
    }
  ),
};

    // Създаване на MCP handler с достъп до настройките
    const handler = createMcpHandler(() => createServer(env));

    return handler(request, env, ctx);
  },
};
