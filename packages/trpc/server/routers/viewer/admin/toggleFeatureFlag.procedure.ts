import { authedAdminProcedure } from "../../../procedures/authedProcedure";
import { ZAdminToggleFeatureFlagSchema } from "./toggleFeatureFlag.schema";

export const toggleFeatureFlag = authedAdminProcedure
  .mutation(async (opts) => {
    const { default: handler } = await import("./toggleFeatureFlag.handler");
    return handler(opts);
  });
