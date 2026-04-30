/**
 * Audit Logger - Compliance and security tracking
 */

import { hostname, userInfo } from "os";
import { scrubSensitiveData } from "./utils/secret-scrubber.js";

export interface AuditEntry {
  timestamp: string;
  user: string;
  tool: string;
  resource?: string;
  namespace?: string;
  action: string;
  success: boolean;
  dataAccessed?: string[];
  clientIp?: string;
  error?: string;
  args?: any;
}

class AuditLogger {
  // Enabled by default for enterprise security, opt-out via env
  private enabled = process.env.K8S_AUDIT_LOG !== "false";

  log(entry: AuditEntry): void {
    if (!this.enabled) return;

    let username = "unknown";
    try {
      username = userInfo().username;
    } catch {
      // Ignore if userInfo fails (can happen in some container environments)
    }

    const enriched = {
      ...entry,
      hostname: hostname(),
      uid: username,
      // Ensure we have a clear marker for log aggregation
      _audit: true 
    };

    // Stringify and then scrub any sensitive data that might be in arguments or errors
    const logString = JSON.stringify(enriched);
    const scrubbedLog = scrubSensitiveData(logString);

    // Emit to stderr (immutable, captured by host/SIEM)
    console.error(scrubbedLog);
  }

  logDataAccess(
    tool: string,
    resourceType: string,
    resourceName: string,
    namespace?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      user: "system",
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
