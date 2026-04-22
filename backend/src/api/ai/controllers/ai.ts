import type { Core } from '@strapi/strapi';

const GEMINI_API_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

const PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash';
const SECONDARY_GEMINI_MODEL = 'gemini-1.5-flash';

const DEFAULT_FALLBACK_SUBTASKS = [
  'Define requirements',
  'Design system architecture',
  'Set up project structure',
  'Implement core features',
  'Test application',
  'Deploy project',
];

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

const buildFallbackSubtasks = (): string[] => DEFAULT_FALLBACK_SUBTASKS.slice(0, 10);

const sendError = (ctx: any, status: number, message: string, details?: unknown) => {
  ctx.status = status;
  return ctx.send({
    subtasks: [],
    error: {
      message,
      ...(details ? { details } : {}),
    },
  });
};

const sendFallback = (ctx: any, status: number, message: string, details?: unknown) => {
  console.warn('Gemini fallback triggered:', { status, message, details });
  return ctx.send({
    subtasks: buildFallbackSubtasks(),
    fallback: true,
    error: true,
    provider: 'gemini',
    status,
    message,
    ...(details ? { details } : {}),
  });
};

const aiController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async generateTodos(ctx: any) {
    console.log('---- AI REQUEST START ----');

    try {
      const authUser = ctx.state?.user;

      if (!authUser || typeof authUser.id !== 'number') {
        return sendError(ctx, 401, 'Authentication required');
      }

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

      console.log('API key exists:', !!apiKey);

      if (!apiKey) {
        return sendFallback(ctx, 500, 'Missing GEMINI_API_KEY');
      }

      const requestGemini = async (model: string) => {
        console.log(`Using model: ${model}`);

        try {
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

          const body = await response.text();

          console.log('Gemini response status:', response.status);
          console.log('Gemini raw response:', body);

          return {
            model,
            status: response.status,
            body,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log('Gemini response status:', 0);
          console.log('Gemini raw response:', message);

          return {
            model,
            status: 0,
            body: message,
          };
        }
      };

      const modelsToTry = [PRIMARY_GEMINI_MODEL, SECONDARY_GEMINI_MODEL];
      let lastFailureStatus = 500;
      let lastFailureMessage = 'Gemini request failed';
      let lastFailureDetails: unknown = undefined;

      for (const model of modelsToTry) {
        const result = await requestGemini(model);

        if (result.status !== 200) {
          lastFailureStatus = result.status || 500;
          lastFailureMessage = result.body || 'Gemini request failed';
          lastFailureDetails = {
            error: true,
            provider: 'gemini',
            status: result.status,
            message: result.body,
            model,
          };
          continue;
        }

        let data: any;

        try {
          data = JSON.parse(result.body);
        } catch (error) {
          console.error('JSON parse failed:', error);
          lastFailureStatus = 502;
          lastFailureMessage = 'Invalid JSON from Gemini';
          lastFailureDetails = {
            error: true,
            provider: 'gemini',
            status: result.status,
            message: result.body,
            model,
          };
          continue;
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('Extracted text:', text);

        if (typeof text !== 'string' || !text.trim()) {
          console.error('Invalid Gemini structure:', data);
          lastFailureStatus = 502;
          lastFailureMessage = 'Gemini response missing text';
          lastFailureDetails = {
            error: true,
            provider: 'gemini',
            status: result.status,
            message: result.body,
            model,
          };
          continue;
        }

        const subtasks = formatSubtasks(text);
        console.log('Final subtasks:', subtasks);

        if (subtasks.length === 0) {
          lastFailureStatus = 502;
          lastFailureMessage = 'Gemini returned no usable subtasks';
          lastFailureDetails = {
            error: true,
            provider: 'gemini',
            status: result.status,
            message: result.body,
            model,
          };
          continue;
        }

        console.log('Gemini model used:', model);
        return ctx.send({ subtasks, fallback: false, provider: 'gemini', modelUsed: model });
      }

      return sendFallback(ctx, lastFailureStatus, lastFailureMessage, lastFailureDetails);
    } catch (error) {
      console.error('FINAL AI ERROR:', error);
      strapi.log.error(`[ai.generate-todos] FINAL AI ERROR: ${error instanceof Error ? error.message : String(error)}`);
      return sendFallback(ctx, 500, error instanceof Error ? error.message : 'AI generation failed');
    }
  },
});

export default aiController;
