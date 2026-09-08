# Enable Ursly services

Application code and provider accounts are separate requirements. A successful deployment does not verify OpenAI quota or real conversations.

## OpenAI

1. Create an account or sign in to [OpenAI Platform](https://platform.openai.com/).
2. Configure [API billing](https://platform.openai.com/settings/organization/billing/overview). A ChatGPT subscription does not replace API billing.
3. Create a [project API key](https://platform.openai.com/api-keys). Check limits and access to `gpt-4.1-mini` and `gpt-realtime`.
4. Locally, set `OPENAI_API_KEY` in `.env.local`, set `PROVIDER_MODE=live`, and rerun `docker compose --env-file .env.local up -d --build web`.
5. On AWS, store the key in **`ursly/openai`**, region **us-east-1**, account **436136277668**. A dedicated key restricted to Responses and Realtime was configured and tested on September 8, 2026. Use a raw string or a JSON object containing `OPENAI_API_KEY`. The backend reads this secret. Never put keys in `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` variables.
6. Run `npm run demo:check -- http://localhost:3100`, adjusting the port, then perform a real voice conversation. The script checks PDF, text response, and credential issuance; it does not replace audio testing.

Public demo routes need appropriate application access controls and usage limits before public paid-provider use. AWS throttling is not authentication.

Never copy keys into Git, issues, or chat. References: [key management](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key), [separate ChatGPT and API billing](https://help.openai.com/en/articles/9039756-billing-settings-in-chatgpt-vs-platform).

## YouTube

The current integration retrieves public captions. It does **not** use a Google API key or OAuth token. Registering with Google therefore does not resolve this service's network blocks.

To prepare an official integration for your own videos:

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Enable [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com).
3. Configure Google Auth Platform and an OAuth client. The OAuth integration and sign-in screen are not implemented in Ursly; there is no redirect URL yet.
4. Authorize an account permitted to edit the videos. Official caption downloads require that permission; an API key alone does not grant access to every public video's captions.

For third-party public videos, verify a caption service compatible with `TRANSCRIPT_SERVICE_URL` from the target hosting environment. Do not declare it operational without a real test. `TRANSCRIPT_MODE=mock` is only a deterministic development fixture.

References: [YouTube API setup](https://developers.google.com/youtube/v3/getting-started), [caption download permissions](https://developers.google.com/youtube/v3/docs/captions/download).

## Before a live demo

- Verify deployment and HTTP/PDF checks.
- Configure OpenAI, confirm model access and available quota, and apply appropriate access controls.
- Test real text and audio conversations, including reconnection and microphone denial.
- Verify the actual YouTube URL from AWS, or disclose the limitation and demonstrate real local retrieval as allowed by the requirements.
- Build with the deployed HTTPS URL and test on phones; sign iOS builds for devices. Release `v0.1.0-demo.1` still uses a local backend.
