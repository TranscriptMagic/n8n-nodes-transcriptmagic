import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TranscriptMagicApi implements ICredentialType {
	name = 'transcriptMagicApi';
	displayName = 'TranscriptMagic API';
	documentationUrl = 'https://docs.transcriptmagic.com/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your TranscriptMagic API key. Create one at https://transcriptmagic.com/dashboard/api-keys/. Keys begin with sk_live_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.transcriptmagic.com',
			url: '/api/balance',
			method: 'GET',
		},
	};
}
