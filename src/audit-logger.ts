/**
 * Audit Logger - Compliance and security tracking
 */

import { createWriteStream } from "fs";
import { hostname, userInfo } from "os";

interface AuditEntry {
  timestamp: string;
  user: string;
  tool: string;
  resource?: string;
  namespace?: string;
  action: string;
  success: boolean;
  dataAccessed?: string[];
  clientIp?: string;
}

class AuditLogger {
  private logStream = createWriteStream("k8s-mcp-audit.log", { flags: "a" });
  private enabled = process.env.K8S_AUDIT_LOG === "true";

  log(entry: AuditEntry): void {
    if (!this.enabled) return;

    const enriched = {
      ...entry,
      hostname: hostname(),
      uid: userInfo().username,
    };

    this.logStream.write(JSON.stringify(enriched) + "\n");
  }

  logDataAccess(
    tool: string,
    resourceType: string,
    resourceName: string,
    namespace?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      user: userInfo().username,
      tool,
      resource: `${resourceType}/${resourceName}`,
      namespace,
      action: "data_access",
      success: true,
      dataAccessed: [resourceType],
    });
  }
}

export const auditLogger = new AuditLogger();
