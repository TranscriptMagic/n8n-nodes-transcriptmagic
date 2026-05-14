import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';
import { version as PACKAGE_VERSION } from '../../package.json';

// Read package version at module load so the X-TM-Client header always
// reflects the running version of the node.
const CLIENT_HEADER = `n8n@${PACKAGE_VERSION}`;
const BASE_URL = 'https://api.transcriptmagic.com';

type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook';

const PLATFORM_PATHS: Record<Platform, string> = {
	youtube: '/api/youtube/transcript',
	tiktok: '/api/tiktok/transcript',
	instagram: '/api/instagram/transcript',
	facebook: '/api/facebook/transcript',
};

// Best-effort extraction of plain transcript text from per-platform responses.
// YouTube returns transcript as an array of timed segments; others return a string.
function extractText(platform: Platform, body: JsonObject): string {
	if (platform === 'youtube') {
		if (typeof body.transcript_only_text === 'string') return body.transcript_only_text;
		if (Array.isArray(body.transcript)) {
			return (body.transcript as Array<{ text?: string }>)
				.map((seg) => seg.text ?? '')
				.filter(Boolean)
				.join(' ');
		}
		return '';
	}
	if (typeof body.transcript === 'string') return body.transcript;
	if (Array.isArray(body.transcripts)) {
		return (body.transcripts as string[]).join('\n');
	}
	return '';
}

export class TranscriptMagic implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TranscriptMagic',
		name: 'transcriptMagic',
		icon: 'file:transcriptMagic.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Fetch transcripts from YouTube, TikTok, Instagram, and Facebook videos via TranscriptMagic.',
		defaults: {
			name: 'TranscriptMagic',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'transcriptMagicApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: BASE_URL,
			headers: {
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Transcript', value: 'transcript' },
					{ name: 'Account', value: 'account' },
				],
				default: 'transcript',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['transcript'] } },
				options: [
					{
						name: 'YouTube',
						value: 'youtube',
						action: 'Fetch a transcript from youtube',
						description: 'Fetch a transcript from a YouTube video URL',
					},
					{
						name: 'TikTok',
						value: 'tiktok',
						action: 'Fetch a transcript from tiktok',
						description: 'Fetch a transcript from a TikTok video URL',
					},
					{
						name: 'Instagram',
						value: 'instagram',
						action: 'Fetch a transcript from instagram',
						description: 'Fetch a transcript from an Instagram video URL',
					},
					{
						name: 'Facebook',
						value: 'facebook',
						action: 'Fetch a transcript from facebook',
						description: 'Fetch a transcript from a Facebook video URL',
					},
				],
				default: 'youtube',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['account'] } },
				options: [
					{
						name: 'Get Credit Balance',
						value: 'getBalance',
						action: 'Get current credit balance',
						description: 'Read the credit balance and plan for the API key. Does not consume a credit.',
					},
				],
				default: 'getBalance',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://www.youtube.com/watch?v=…',
				description: 'The video URL to transcribe',
				displayOptions: { show: { resource: ['transcript'] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { resource: ['transcript'] } },
				options: [
					{
						displayName: 'Output Format',
						name: 'outputFormat',
						type: 'options',
						options: [
							{
								name: 'Normalized',
								value: 'normalized',
								description: 'Return text, platform, credits, and URL — hides per-platform response-shape differences',
							},
							{
								name: 'Raw',
								value: 'raw',
								description: 'Return the upstream API response verbatim',
							},
						],
						default: 'normalized',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				let responseBody: JsonObject;

				if (resource === 'account' && operation === 'getBalance') {
					responseBody = await callTranscriptMagic.call(this, {
						method: 'GET',
						url: '/api/balance',
					});
					returnData.push({ json: responseBody, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'transcript') {
					const platform = operation as Platform;
					const path = PLATFORM_PATHS[platform];
					if (!path) {
						throw new NodeOperationError(this.getNode(), `Unknown platform: ${platform}`, {
							itemIndex: i,
						});
					}

					const url = (this.getNodeParameter('url', i) as string).trim();
					if (!url) {
						throw new NodeOperationError(this.getNode(), 'URL is required', { itemIndex: i });
					}

					const options = this.getNodeParameter('options', i, {}) as {
						outputFormat?: 'normalized' | 'raw';
					};
					const outputFormat = options.outputFormat ?? 'normalized';

					responseBody = await callTranscriptMagic.call(this, {
						method: 'POST',
						url: path,
						body: { url },
					});

					if (outputFormat === 'raw') {
						returnData.push({ json: responseBody, pairedItem: { item: i } });
					} else {
						returnData.push({
							json: {
								text: extractText(platform, responseBody),
								platform,
								credits: typeof responseBody.credits === 'number' ? responseBody.credits : null,
								url,
							},
							pairedItem: { item: i },
						});
					}
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					`Unknown resource/operation: ${resource}/${operation}`,
					{ itemIndex: i },
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

// Wrap the credentialed HTTP request so we can stamp the X-TM-Client header
// and honor 429 Retry-After with a single retry.
async function callTranscriptMagic(
	this: IExecuteFunctions,
	opts: { method: 'GET' | 'POST'; url: string; body?: JsonObject },
): Promise<JsonObject> {
	const requestOptions: IHttpRequestOptions = {
		method: opts.method,
		url: `${BASE_URL}${opts.url}`,
		json: true,
		headers: {
			'X-TM-Client': CLIENT_HEADER,
		},
		returnFullResponse: true,
	};

	if (opts.body !== undefined) {
		requestOptions.body = opts.body;
	}

	const send = async () =>
		(await this.helpers.httpRequestWithAuthentication.call(
			this,
			'transcriptMagicApi',
			requestOptions,
		)) as { statusCode: number; headers: Record<string, string | string[]>; body: JsonObject };

	let response;
	try {
		response = await send();
	} catch (error) {
		// Single retry on 429 Retry-After
		const errAny = error as { httpCode?: string | number; response?: { headers?: Record<string, string | string[]>; statusCode?: number } };
		const status = Number(errAny.httpCode ?? errAny.response?.statusCode ?? 0);
		if (status === 429) {
			const retryAfter = headerValue(errAny.response?.headers, 'retry-after');
			const delayMs = (parseInt(retryAfter || '5', 10) || 5) * 1000;
			await sleep(delayMs);
			response = await send();
		} else {
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}
	}

	return response.body;
}

function headerValue(
	headers: Record<string, string | string[]> | undefined,
	name: string,
): string | undefined {
	if (!headers) return undefined;
	const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
	if (!key) return undefined;
	const v = headers[key];
	return Array.isArray(v) ? v[0] : v;
}
