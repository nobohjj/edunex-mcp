import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

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
        const response = await fetch(env.https://script.google.com/macros/s/AKfycbwYnDQv9pqSddFemCtvOMb9JEk3frUeMpnIU90bFsiTlJ-X_G9mzCuDLLhC-rfof8S6RA/exec, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            secret: env.8b08d6d5-1e10-4f27-95b6-1374f3b4cacf2fb3a449-fa2f-480a-a43f-26698a3ce651,
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
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Защита на EduNex MCP
    const suppliedSecret = request.headers.get(
      "x-edunex-mcp-secret"
    );

    if (
      !env.52c90476-6167-466c-9d62-6ef62ea9d2df791ab61d-5f10-45ff-9429-74fa4f9ac7e1 ||
      suppliedSecret !== env.52c90476-6167-466c-9d62-6ef62ea9d2df791ab61d-5f10-45ff-9429-74fa4f9ac7e1
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Създаване на MCP handler с достъп до настройките
    const handler = createMcpHandler(() => createServer(env));

    return handler(request, env, ctx);
  },
};
