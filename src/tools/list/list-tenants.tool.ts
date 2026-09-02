import { listXeroTenants } from "../../handlers/list-xero-tenants.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListTenantsTool = CreateXeroTool(
  "list-tenants",
  "List all Xero organisations/tenants connected to this app's authorization. Shows tenant ID, name, type, and which tenant is currently active.",
  {},
  async () => {
    const response = await listXeroTenants();

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing tenants: ${response.error}`,
          },
        ],
      };
    }

    const tenants = response.result;

    if (!tenants || tenants.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No connected tenants found.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${tenants.length} connected tenant(s):`,
        },
        ...tenants.map((tenant) => ({
          type: "text" as const,
          text: [
            `${tenant.isActive ? "(active) " : ""}${tenant.tenantName}`,
            `  Tenant ID: ${tenant.tenantId}`,
            `  Type: ${tenant.tenantType}`,
          ].join("\n"),
        })),
      ],
    };
  },
);

export default ListTenantsTool;
