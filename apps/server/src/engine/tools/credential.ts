import { randomUUID } from 'crypto';
import type { Tool, ToolInput, ToolOutput, ToolDefinition, ToolContext } from './types.js';
import { CredentialRepository } from '../../db/credentials.js';

export class CredentialTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'credential',
    description:
      'Request credentials (login, password, API key, token) from the user securely. ' +
      'Never stores credentials in chat or logs. ' +
      'Use this instead of asking users to paste secrets in chat.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['request', 'check', 'vault_list'],
          description:
            'request=ask user for credential, ' +
            'check=check if a request was fulfilled, ' +
            'vault_list=list saved credentials (no values)',
        },
        label: {
          type: 'string',
          description: 'Human-readable label (e.g., "GitHub Token", "AWS Access Key")',
        },
        service: {
          type: 'string',
          description: 'Service name (e.g., "github", "aws", "openai")',
        },
        reason: {
          type: 'string',
          description: 'Why the credential is needed',
        },
        requestId: {
          type: 'string',
          description: 'Request ID to check status (required for check action)',
        },
      },
      required: ['action'],
    },
  };

  async execute(input: ToolInput, context?: ToolContext): Promise<ToolOutput> {
    const action = input['action'] as string | undefined;
    if (!action) return { success: false, error: 'action is required' };

    if (!context?.db) {
      return { success: false, error: 'Database context is required for credential tool' };
    }

    const repo = new CredentialRepository(context.db);

    try {
      switch (action) {
        case 'request': {
          const label = input['label'] as string | undefined;
          if (!label?.trim()) {
            return { success: false, error: 'label is required for request action' };
          }

          const sessionId = context.sessionId ?? randomUUID();
          const agentId = context.agentId;

          const creq = repo.createRequest({
            sessionId,
            agentId,
            label,
            service: (input['service'] as string | undefined) ?? '',
            reason: (input['reason'] as string | undefined) ?? '',
            oneTime: true, // always one-time by default for security
          });

          // IMPORTANT: We NEVER return the credential value in tool output.
          // The agent gets a requestId and tells the user to provide it securely via the UI.
          return {
            success: true,
            result: {
              requestId: creq.id,
              status: 'pending',
              message:
                `A secure credential request has been created (ID: ${creq.id}). ` +
                `The user will be prompted to enter "${label}" securely via the Credential modal in the UI. ` +
                `Use action=check with requestId="${creq.id}" to verify when the user has provided it.`,
            },
          };
        }

        case 'check': {
          const requestId = input['requestId'] as string | undefined;
          if (!requestId?.trim()) {
            return { success: false, error: 'requestId is required for check action' };
          }

          const creq = repo.getRequest(requestId);
          if (!creq) {
            return { success: false, error: `Credential request not found: ${requestId}` };
          }

          // IMPORTANT: NEVER return the actual credential value — not even here.
          // The credential stays in the vault; the agent uses credential_id to know it's available.
          return {
            success: true,
            result: {
              requestId: creq.id,
              status: creq.status,
              label: creq.label,
              service: creq.service,
              // credentialId only returned when status is 'provided' — lets the engine
              // retrieve it directly from vault via the secure retrieve endpoint
              ...(creq.status === 'provided' && creq.credentialId
                ? { credentialId: creq.credentialId, message: 'Credential has been provided by the user and stored securely.' }
                : { message: creq.status === 'pending' ? 'Still waiting for user to provide the credential.' : `Request status: ${creq.status}` }),
            },
          };
        }

        case 'vault_list': {
          const entries = repo.listVault();
          // NEVER include values — only metadata
          return {
            success: true,
            result: {
              entries: entries.map(e => ({
                id: e.id,
                label: e.label,
                service: e.service,
                oneTime: e.oneTime,
                used: e.used,
                expiresAt: e.expiresAt,
              })),
              count: entries.length,
              message:
                entries.length > 0
                  ? `Found ${entries.length} saved credential(s) in vault.`
                  : 'No credentials in vault. Use action=request to ask the user for one.',
            },
          };
        }

        default:
          return {
            success: false,
            error: `Unknown action: ${action}. Use request, check, or vault_list.`,
          };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
