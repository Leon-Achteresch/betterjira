import type { ScmConnection } from "./model";

export type ReviewThreadsCapability = (connection: ScmConnection) => boolean;
export const reviewThreadsAllowed: ReviewThreadsCapability = () => false;
