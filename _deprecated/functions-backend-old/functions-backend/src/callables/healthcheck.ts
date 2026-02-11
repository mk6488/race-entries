import * as functions from 'firebase-functions';
import { REGION, admin } from '../shared/config';

type HealthcheckResponse = {
  ok: true;
  region: string;
  projectId: string;
  time: string;
  authed: boolean;
  uid?: string;
};

function getProjectId(): string {
  // Best-effort; different runtimes set different env vars.
  return (
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    admin.app().options.projectId ||
    'unknown'
  );
}

/**
 * healthcheck
 * Input: {}
 * Output: { ok:true, region, projectId, time, authed:boolean, uid?:string }
 */
export const healthcheck = functions.region(REGION).https.onCall(async (_data: any, context) => {
  const uid = context.auth?.uid || null;

  const res: HealthcheckResponse = {
    ok: true,
    region: REGION,
    projectId: getProjectId(),
    time: new Date().toISOString(),
    authed: Boolean(uid),
    ...(uid ? { uid } : {}),
  };

  return res;
});
