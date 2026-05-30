import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { StatusCodes } from "http-status-codes";
import { MiddlewareType } from "../shared/middleware-type/middleware.type";
import { NotFoundError } from "../errors/not-found.error";
import { multiFileSwagger } from "../tools/multi-file-swagger";
import { AppConfig } from "../config/app";

export interface AppDependencies {
  router: express.Router;
  errorHandler: MiddlewareType;
  appConfig: AppConfig;
}

async function createApp({ router, errorHandler, appConfig }: AppDependencies) {
  const app = express();

  app.use(cors());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'", "https: 'unsafe-inline'"],
        },
      },
    }),
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(StatusCodes.OK).json({
      status: "ok",
      deployedCommit: appConfig.deployedCommit,
    });
  });

  const swaggerDocument = await multiFileSwagger(YAML.load("../swagger/api.yaml"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use("/api", router);
  app.use("*", (_req, _res, next) => next(new NotFoundError("Page not found")));
  app.use(errorHandler);

  return app;
}

export { createApp };
