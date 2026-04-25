import { z } from 'zod';

const userFeedbackSchema = z.object({
  id: z.string().optional(),
  username: z.string().optional(),
  bug: z.string().optional(),
  voted_features: z.array(z.string()).optional(),
  proposal: z.string().optional(),
  general: z.string().optional(),
  created_at: z.date().optional()
});

const submitUserFeedbackBodySchema = z.object({
  id: z.string().optional(),
  bug: z.string().optional(),
  voted_features: z.array(z.string()).optional(),
  proposal: z.string().optional(),
  general: z.string().optional()
});

const buildUserFeedback = ({ body, username }) => userFeedbackSchema.parse({
  ...submitUserFeedbackBodySchema.parse(body),
  username: username || 'anonymous',
  created_at: new Date()
});

const parseUserFeedbacks = (documents) => z.array(userFeedbackSchema).parse(documents);

export {
  buildUserFeedback,
  parseUserFeedbacks
};
