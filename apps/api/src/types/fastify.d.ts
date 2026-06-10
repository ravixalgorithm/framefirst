import type { FastifyReply, FastifyRequest as FrameFirstFastifyRequest } from "fastify";

export type AuthUser = {
  id: string;
  email: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }

  interface FastifyInstance {
    authenticate(request: FrameFirstFastifyRequest, reply: FastifyReply): Promise<void>;
  }
}
