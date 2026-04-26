import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import * as yaml from "js-yaml";
import { classifyError, validateYamlManifest, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace } from "../validators.js";

export function registerStorageTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_pvs",
        description: "List all PersistentVolumes",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const pvs = await k8sClient.listPVs();
          return {
            persistentVolumes: pvs.map((pv: k8s.V1PersistentVolume) => ({
              name: pv.metadata?.name,
              capacity: pv.spec?.capacity?.storage,
              accessModes: pv.spec?.accessModes,
              reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
              status: pv.status?.phase,
              storageClass: pv.spec?.storageClassName,
              volumeMode: pv.spec?.volumeMode,
              source: getPVSource(pv.spec),
              claim: pv.spec?.claimRef ? {
                name: pv.spec.claimRef.name,
                namespace: pv.spec.claimRef.namespace,
              } : null,
              age: pv.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_pvs" };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_list_pvcs",
        description: "List all PersistentVolumeClaims",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const response = namespace
            ? await coreApi.listNamespacedPersistentVolumeClaim(namespace)
            : await coreApi.listPersistentVolumeClaimForAllNamespaces();
          return {
            persistentVolumeClaims: response.body.items.map((pvc: k8s.V1PersistentVolumeClaim) => ({
              name: pvc.metadata?.name,
              namespace: pvc.metadata?.namespace,
              status: pvc.status?.phase,
              volume: pvc.spec?.volumeName,
              storageClass: pvc.spec?.storageClassName,
              accessModes: pvc.spec?.accessModes,
              capacity: pvc.status?.capacity?.storage,
              requestedStorage: pvc.spec?.resources?.requests?.storage,
              volumeMode: pvc.spec?.volumeMode,
              age: pvc.metadata?.creationTimestamp,
              isBound: pvc.status?.phase === "Bound",
            })),
            total: response.body.items.length,
            bound: response.body.items.filter((p: k8s.V1PersistentVolumeClaim) => p.status?.phase === "Bound").length,
            unbound: response.body.items.filter((p: k8s.V1PersistentVolumeClaim) => p.status?.phase !== "Bound").length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_pvcs", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_list_storageclasses",
        description: "List all StorageClasses",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const storageApi = (k8sClient as any).kc.makeApiClient(k8s.StorageV1Api);
          const response = await storageApi.listStorageClass();
          return {
            storageClasses: response.body.items.map((sc: k8s.V1StorageClass) => ({
              name: sc.metadata?.name,
              provisioner: sc.provisioner,
              reclaimPolicy: sc.reclaimPolicy,
              volumeBindingMode: sc.volumeBindingMode,
              allowVolumeExpansion: sc.allowVolumeExpansion,
              isDefault: sc.metadata?.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true",
              parameters: sc.parameters,
              age: sc.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_storageclasses" };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Get PersistentVolume
    {
      tool: {
        name: "k8s_get_pv",
        description: "Get detailed information about a PersistentVolume",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PersistentVolume",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name }: { name: string }) => {
        try {
          validateResourceName(name, "persistentvolume");
          const coreApi = k8sClient.getCoreV1Api();
          const result = await coreApi.readPersistentVolume(name);
          const pv = result.body;

          return {
            name: pv.metadata?.name,
            capacity: pv.spec?.capacity?.storage,
            accessModes: pv.spec?.accessModes,
            reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
            storageClassName: pv.spec?.storageClassName,
            volumeMode: pv.spec?.volumeMode,
            status: pv.status?.phase,
            claimRef: pv.spec?.claimRef ? {
              name: pv.spec.claimRef.name,
              namespace: pv.spec.claimRef.namespace,
              kind: pv.spec.claimRef.kind,
            } : null,
            source: getPVSource(pv.spec),
            nodeAffinity: pv.spec?.nodeAffinity,
            mountOptions: pv.spec?.mountOptions,
            volumeAttributes: pv.spec?.csi?.volumeAttributes,
            reason: pv.status?.reason,
            message: pv.status?.message,
            age: pv.metadata?.creationTimestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_pv", resource: name };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Get StorageClass
    {
      tool: {
        name: "k8s_get_storageclass",
        description: "Get detailed information about a StorageClass",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the StorageClass",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name }: { name: string }) => {
        try {
          validateResourceName(name, "storageclass");
          const storageApi = (k8sClient as any).kc.makeApiClient(k8s.StorageV1Api);
          const result = await storageApi.readStorageClass(name);
          const sc = result.body;

          return {
            name: sc.metadata?.name,
            provisioner: sc.provisioner,
            reclaimPolicy: sc.reclaimPolicy,
            volumeBindingMode: sc.volumeBindingMode,
            allowVolumeExpansion: sc.allowVolumeExpansion,
            isDefault: sc.metadata?.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true",
            parameters: sc.parameters,
            mountOptions: sc.mountOptions,
            allowedTopologies: sc.allowedTopologies,
            age: sc.metadata?.creationTimestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_storageclass", resource: name };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_get_pvc_details",
        description: "Get detailed information about a PVC including events",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PVC",
            },
            namespace: {
              type: "string",
              description: "Namespace of the PVC",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "pvc");
          const coreApi = k8sClient.getCoreV1Api();
          const [pvc, events] = await Promise.all([
            coreApi.readNamespacedPersistentVolumeClaim(name, namespace || "default"),
            k8sClient.listEvents(namespace || "default", `involvedObject.name=${name}`),
          ]);

          return {
            name: pvc.body.metadata?.name,
            namespace: pvc.body.metadata?.namespace,
            spec: {
              accessModes: pvc.body.spec?.accessModes,
              storageClassName: pvc.body.spec?.storageClassName,
              volumeName: pvc.body.spec?.volumeName,
              volumeMode: pvc.body.spec?.volumeMode,
              resources: pvc.body.spec?.resources,
              selector: pvc.body.spec?.selector,
            },
            status: {
              phase: pvc.body.status?.phase,
              accessModes: pvc.body.status?.accessModes,
              capacity: pvc.body.status?.capacity,
              conditions: pvc.body.status?.conditions?.map((c: k8s.V1PersistentVolumeClaimCondition) => ({
                type: c.type,
                status: c.status,
                reason: c.reason,
                message: c.message,
              })),
            },
            events: events.map((e: k8s.CoreV1Event) => ({
              type: e.type,
              reason: e.reason,
              message: e.message,
              count: e.count,
              firstTimestamp: e.firstTimestamp,
              lastTimestamp: e.lastTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_pvc_details", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_find_unbound_pvcs",
        description: "Find PVCs that are not bound to a PV",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to check (optional, all if not specified)",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const response = namespace
            ? await coreApi.listNamespacedPersistentVolumeClaim(namespace)
            : await coreApi.listPersistentVolumeClaimForAllNamespaces();

          const unboundPvcs = response.body.items.filter(
            (pvc: k8s.V1PersistentVolumeClaim) => pvc.status?.phase !== "Bound"
          );

          return {
            unboundPvcs: unboundPvcs.map((pvc: k8s.V1PersistentVolumeClaim) => ({
              name: pvc.metadata?.name,
              namespace: pvc.metadata?.namespace,
              status: pvc.status?.phase,
              capacity: pvc.spec?.resources?.requests?.storage,
              storageClass: pvc.spec?.storageClassName,
              age: pvc.metadata?.creationTimestamp,
            })),
            totalPvcs: response.body.items.length,
            unboundCount: unboundPvcs.length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_find_unbound_pvcs", namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_storage_summary",
        description: "Get cluster-wide storage summary",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          const storageApi = (k8sClient as any).kc.makeApiClient(k8s.StorageV1Api);

          const [pvs, pvcs, storageClasses] = await Promise.all([
            coreApi.listPersistentVolume(),
            coreApi.listPersistentVolumeClaimForAllNamespaces(),
            storageApi.listStorageClass(),
          ]);

          const totalCapacity = pvs.body.items.reduce(
            (sum: number, pv: k8s.V1PersistentVolume) =>
              sum + (parseInt(pv.spec?.capacity?.storage || "0") || 0),
            0
          );

          const usedCapacity = pvcs.body.items.reduce(
            (sum: number, pvc: k8s.V1PersistentVolumeClaim) =>
              sum + (parseInt(pvc.spec?.resources?.requests?.storage || "0") || 0),
            0
          );

          const boundPvcs = pvcs.body.items.filter(
            (pvc: k8s.V1PersistentVolumeClaim) => pvc.status?.phase === "Bound"
          ).length;

          return {
            persistentVolumes: {
              total: pvs.body.items.length,
              available: pvs.body.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Available").length,
              bound: pvs.body.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Bound").length,
              released: pvs.body.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Released").length,
              failed: pvs.body.items.filter((pv: k8s.V1PersistentVolume) => pv.status?.phase === "Failed").length,
            },
            persistentVolumeClaims: {
              total: pvcs.body.items.length,
              bound: boundPvcs,
              pending: pvcs.body.items.filter((pvc: k8s.V1PersistentVolumeClaim) => pvc.status?.phase === "Pending").length,
            },
            storageClasses: {
              total: storageClasses.body.items.length,
              default: storageClasses.body.items.filter(
                (sc: k8s.V1StorageClass) =>
                  sc.metadata?.annotations?.["storageclass.kubernetes.io/is-default-storageclass"] === "true"
              ).length,
            },
            capacity: {
              total: `${totalCapacity}Gi`,
              used: `${usedCapacity}Gi`,
              available: `${totalCapacity - usedCapacity}Gi`,
              utilizationPercent: totalCapacity > 0 ? ((usedCapacity / totalCapacity) * 100).toFixed(2) : "0",
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_storage_summary" };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Delete PVC
    {
      tool: {
        name: "k8s_delete_pvc",
        description: "Delete a PersistentVolumeClaim",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PVC to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the PVC",
              default: "default",
            },
            gracePeriodSeconds: {
              type: "number",
              description: "Grace period for termination",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, gracePeriodSeconds }: { 
        name: string; 
        namespace?: string;
        gracePeriodSeconds?: number;
      }) => {
        try {
          validateResourceName(name, "pvc");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await coreApi.deleteNamespacedPersistentVolumeClaim(name, ns, undefined, options);
          
          return {
            success: true,
            message: `PVC ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_pvc", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Create PVC
    {
      tool: {
        name: "k8s_create_pvc",
        description: "Create a PersistentVolumeClaim (like kubectl create pvc or apply -f pvc.yaml)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PVC",
            },
            namespace: {
              type: "string",
              description: "Namespace for the PVC",
              default: "default",
            },
            storageClass: {
              type: "string",
              description: "StorageClass name (omit for default)",
            },
            size: {
              type: "string",
              description: "Storage size (e.g., '10Gi', '500Mi')",
            },
            accessModes: {
              type: "array",
              description: "Access modes",
              items: { type: "string", enum: ["ReadWriteOnce", "ReadOnlyMany", "ReadWriteMany", "ReadWriteOncePod"] },
              default: ["ReadWriteOnce"],
            },
            volumeName: {
              type: "string",
              description: "Specific PV to bind to (optional, for pre-bound PVCs)",
            },
            volumeMode: {
              type: "string",
              description: "Volume mode (Filesystem or Block)",
              enum: ["Filesystem", "Block"],
              default: "Filesystem",
            },
            labels: {
              type: "object",
              description: "Labels to add to the PVC",
            },
            annotations: {
              type: "object",
              description: "Annotations to add to the PVC",
            },
          },
          required: ["name", "size"],
        },
      },
      handler: async ({ name, namespace, storageClass, size, accessModes, volumeName, volumeMode, labels, annotations }: { 
        name: string;
        namespace?: string;
        storageClass?: string;
        size: string;
        accessModes?: string[];
        volumeName?: string;
        volumeMode?: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      }) => {
        try {
          validateResourceName(name, "pvc");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const pvc: k8s.V1PersistentVolumeClaim = {
            apiVersion: "v1",
            kind: "PersistentVolumeClaim",
            metadata: {
              name,
              namespace: ns,
              labels,
              annotations: storageClass ? { ...annotations, "volume.beta.kubernetes.io/storage-class": storageClass } : annotations,
            },
            spec: {
              accessModes: accessModes || ["ReadWriteOnce"],
              volumeMode: volumeMode || "Filesystem",
              resources: {
                requests: {
                  storage: size,
                },
              },
              storageClassName: storageClass,
              volumeName,
            },
          };
          
          const result = await coreApi.createNamespacedPersistentVolumeClaim(ns, pvc);
          
          return {
            success: true,
            message: `PVC ${name} created in namespace ${ns}`,
            pvc: {
              name: result.body.metadata?.name,
              namespace: result.body.metadata?.namespace,
              size,
              storageClass: result.body.spec?.storageClassName,
              accessModes: result.body.spec?.accessModes,
              phase: result.body.status?.phase,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_pvc", resource: name, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    // Create PV (cluster admin)
    {
      tool: {
        name: "k8s_create_pv",
        description: "Create a PersistentVolume (cluster admin operation, like kubectl create pv or apply -f pv.yaml)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the PV",
            },
            capacity: {
              type: "string",
              description: "Storage capacity (e.g., '10Gi', '500Mi')",
            },
            accessModes: {
              type: "array",
              description: "Access modes",
              items: { type: "string", enum: ["ReadWriteOnce", "ReadOnlyMany", "ReadWriteMany", "ReadWriteOncePod"] },
              default: ["ReadWriteOnce"],
            },
            storageClass: {
              type: "string",
              description: "StorageClass name",
            },
            volumeMode: {
              type: "string",
              description: "Volume mode (Filesystem or Block)",
              enum: ["Filesystem", "Block"],
              default: "Filesystem",
            },
            reclaimPolicy: {
              type: "string",
              description: "Reclaim policy",
              enum: ["Retain", "Recycle", "Delete"],
              default: "Retain",
            },
            path: {
              type: "string",
              description: "Host path (for hostPath volumes)",
            },
            nfsServer: {
              type: "string",
              description: "NFS server (for NFS volumes)",
            },
            nfsPath: {
              type: "string",
              description: "NFS path (for NFS volumes)",
            },
            csiDriver: {
              type: "string",
              description: "CSI driver name (for CSI volumes)",
            },
            csiVolumeHandle: {
              type: "string",
              description: "CSI volume handle (for CSI volumes)",
            },
            nodeAffinity: {
              type: "object",
              description: "Node affinity for local volumes",
            },
          },
          required: ["name", "capacity"],
        },
      },
      handler: async ({ name, capacity, accessModes, storageClass, volumeMode, reclaimPolicy, path, nfsServer, nfsPath, csiDriver, csiVolumeHandle, nodeAffinity }: { 
        name: string;
        capacity: string;
        accessModes?: string[];
        storageClass?: string;
        volumeMode?: string;
        reclaimPolicy?: string;
        path?: string;
        nfsServer?: string;
        nfsPath?: string;
        csiDriver?: string;
        csiVolumeHandle?: string;
        nodeAffinity?: any;
      }) => {
        try {
          validateResourceName(name, "pv");
          const coreApi = k8sClient.getCoreV1Api();
          
          // Build the PV spec based on volume type
          let pvSpec: k8s.V1PersistentVolumeSpec = {
            capacity: {
              storage: capacity,
            },
            accessModes: accessModes || ["ReadWriteOnce"],
            volumeMode: volumeMode || "Filesystem",
            persistentVolumeReclaimPolicy: reclaimPolicy || "Retain",
            storageClassName: storageClass,
          };
          
          // Add volume source based on provided parameters
          if (path) {
            (pvSpec as any).hostPath = { path };
          } else if (nfsServer && nfsPath) {
            (pvSpec as any).nfs = { server: nfsServer, path: nfsPath };
          } else if (csiDriver && csiVolumeHandle) {
            (pvSpec as any).csi = { driver: csiDriver, volumeHandle: csiVolumeHandle };
          } else {
            return {
              success: false,
              error: "Volume type not specified. Provide path (hostPath), nfsServer+nfsPath (NFS), or csiDriver+csiVolumeHandle (CSI)",
            };
          }
          
          if (nodeAffinity) {
            pvSpec.nodeAffinity = nodeAffinity;
          }
          
          const pv: k8s.V1PersistentVolume = {
            apiVersion: "v1",
            kind: "PersistentVolume",
            metadata: {
              name,
            },
            spec: pvSpec,
          };
          
          const result = await coreApi.createPersistentVolume(pv);
          
          return {
            success: true,
            message: `PersistentVolume ${name} created`,
            pv: {
              name: result.body.metadata?.name,
              capacity,
              accessModes: result.body.spec?.accessModes,
              storageClass: result.body.spec?.storageClassName,
              reclaimPolicy: result.body.spec?.persistentVolumeReclaimPolicy,
              phase: result.body.status?.phase,
              source: getPVSource(result.body.spec),
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_pv", resource: name };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
  ];
}

function getPVSource(spec?: k8s.V1PersistentVolumeSpec): string {
  if (!spec) return "unknown";
  
  const sources = [
    "nfs", "hostPath", "awsElasticBlockStore", "gcePersistentDisk",
    "azureDisk", "azureFile", "csi", "fc", "iscsi", "local", "rbd",
    "vsphereVolume", "cinder", "cephfs", "fc", "flexVolume", "flocker",
    "glusterfs", "photonPersistentDisk", "portworxVolume", "quobyte",
    "scaleIO", "storageos", "vsphereVolume"
  ];
  
  for (const source of sources) {
    if ((spec as any)[source]) {
      return source;
    }
  }
  
  return "unknown";
}

function parseStorageSize(size: string): number {
  const units: Record<string, number> = {
    "Ki": 1 / (1024 * 1024),
    "Mi": 1 / 1024,
    "Gi": 1,
    "Ti": 1024,
    "Pi": 1024 * 1024,
    "K": 1 / (1000 * 1000 * 1000),
    "M": 1 / (1000 * 1000),
    "G": 1 / 1000,
    "T": 1,
    "P": 1000,
  };
  
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|Pi|K|M|G|T|P)?$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || "Gi";
  
  return value * (units[unit] || 1);
}
