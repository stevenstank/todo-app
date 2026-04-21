import type { Core } from '@strapi/strapi';

const GEMINI_API_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

const sanitizeLine = (line: string): string =>
  line
    .replace(/^[0-9-.)\s]+/, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/^\"|\"$/g, '')
    .replace(/^'|'$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatSubtasks = (text: string): string[] =>
  text
    .split('\n')
    .map((item) => sanitizeLine(item))
    .filter(Boolean)
    .slice(0, 10);

const sendError = (ctx: any, status: number, message: string, details?: unknown) => {
  ctx.status = status;
  ctx.body = {
    subtasks: [],
    error: {
      message,
      ...(details ? { details } : {}),
    },
  };
};

const mapGeminiStatus = (status: number): number => {
  if (status === 400) {
    return 400;
  }

  if (status === 401 || status === 403) {
    return 502;
  }

  if (status === 404) {
    return 502;
  }

  if (status === 429) {
    return 429;
  }

  if (status >= 500) {
    return 502;
  }

  return 500;
};

const aiController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async generateTodos(ctx: any) {
    console.log('---- AI REQUEST START ----');

    try {
      console.log('Request body:', ctx.request.body);
      const { task } = ctx.request.body ?? {};

      if (typeof task !== 'string' || !task.trim()) {
        console.error('Missing task input');
        return sendError(ctx, 400, 'Task is required');
      }

      const normalizedTask = task.trim();

      if (normalizedTask.length > 500) {
        return sendError(ctx, 400, 'Task is too long');
      }

      const apiKey = process.env.GEMINI_API_KEY;
      const configuredModel = (process.env.GEMINI_MODEL ?? 'gemini-2.0-flash').trim() || 'gemini-2.0-flash';

      console.log('API key exists:', !!apiKey);

      if (!apiKey) {
        return sendError(ctx, 500, 'Missing GEMINI_API_KEY');
      }

      const modelsToTry = Array.from(
        new Set([configuredModel, 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest'])
      );
      let rawText = '';
      let responseStatus = 0;
      let successful = false;
      let successfulModel = configuredModel;

      for (const model of modelsToTry) {
        const response = await fetch(GEMINI_API_URL(model, apiKey), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Break this task into 5-10 subtasks:\n${normalizedTask}`,
                  },
                ],
              },
            ],
          }),
        });

        responseStatus = response.status;
        rawText = await response.text();
        console.log(`Gemini status (${model}):`, response.status);
        console.log(`Gemini raw response (${model}):`, rawText);

        if (response.ok) {
          successful = true;
          successfulModel = model;
          break;
        }

        const modelMissing = response.status === 404 && rawText.includes('not found');
        if (!modelMissing) {
          return sendError(ctx, mapGeminiStatus(response.status), 'Gemini API failed', {
            model,
            status: response.status,
            body: rawText,
          });
        }
      }

      if (!successful) {
        return sendError(ctx, mapGeminiStatus(responseStatus), 'Gemini API failed', {
          model: configuredModel,
          fallbackTried: true,
          status: responseStatus,
          body: rawText,
        });
      }

      console.log('Gemini model used:', successfulModel);

      let data: any;

      try {
        data = JSON.parse(rawText);
      } catch (error) {
        console.error('JSON parse failed:', error);
        return sendError(ctx, 500, 'Invalid JSON from AI');
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log('Extracted text:', text);

      if (!text) {
        console.error('Invalid Gemini structure:', data);
        return sendError(ctx, 500, 'AI response structure invalid', data);
      }

      const subtasks = formatSubtasks(text);
      console.log('Final subtasks:', subtasks);

      if (subtasks.length === 0) {
        return sendError(ctx, 500, 'AI returned no usable subtasks');
      }

      return ctx.send({ subtasks });
    } catch (error) {
      console.error('FINAL AI ERROR:', error);
      strapi.log.error(`[ai.generate-todos] FINAL AI ERROR: ${error instanceof Error ? error.message : String(error)}`);
      return sendError(ctx, 500, error instanceof Error ? error.message : 'AI generation failed');
    }
  },
});

export default aiController;
