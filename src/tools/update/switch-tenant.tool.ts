import { z } from "zod";
import { switchXeroTenant } from "../../handlers/switch-xero-tenant.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const SwitchTenantTool = CreateXeroTool(
  "switch-tenant",
  "Switch the active Xero tenant/organisation. Subsequent calls that don't pass their own tenantId override will use this tenant. Use list-tenants to see available options.",
  {
    tenantId: z
      .string()
      .describe("The tenant ID to switch to. Use list-tenants to see available tenant IDs."),
  },
  async ({ tenantId }) => {
    const response = await switchXeroTenant(tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error switching tenant: ${response.error}`,
          },
        ],
      };
    }

    const result = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully switched to tenant: ${result?.tenantName} (${result?.tenantId})`,
        },
      ],
    };
  },
);

export default SwitchTenantTool;
