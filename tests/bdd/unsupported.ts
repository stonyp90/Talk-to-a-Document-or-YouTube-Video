// Explicit inventory. Newly added unknown steps remain undefined and fail.
// @external is assigned in feature files only for external evidence requirements.
// All locally unfinished checks remain pending and fail the strict local gate.
export const pendingSteps: Array<[string, string]> = [
  [
    "a pull request targets the repository",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "the pull request workflow runs",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "linting passes",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "strict typechecking passes",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "unit tests pass",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "all Gherkin acceptance tests pass",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "the web build passes",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "dependency and secret scans pass",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request",
  ],
  [
    "a pull request passes source checks",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Build the backend Docker image on a pull request",
  ],
  [
    "the CI workflow builds the backend",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Build the backend Docker image on a pull request",
  ],
  [
    "the Lambda-compatible Docker image builds reproducibly",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Build the backend Docker image on a pull request",
  ],
  [
    "the image is validated without publishing production credentials",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Build the backend Docker image on a pull request",
  ],
  [
    "a workflow run is not for the approved deployment branch or environment",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Prevent deployment from an untrusted branch",
  ],
  [
    "deployment authorization is evaluated",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Prevent deployment from an untrusted branch",
  ],
  [
    "production deployment is blocked",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Prevent deployment from an untrusted branch",
  ],
  [
    "all required checks pass on `main`",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Assume the AWS deploy role through GitHub OIDC on main",
  ],
  [
    "the deployment workflow requests AWS access",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Assume the AWS deploy role through GitHub OIDC on main",
  ],
  [
    "GitHub Actions exchanges its OIDC identity for short-lived AWS credentials",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Assume the AWS deploy role through GitHub OIDC on main",
  ],
  [
    "no static AWS access key is used",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Assume the AWS deploy role through GitHub OIDC on main",
  ],
  [
    "the main deployment workflow has assumed the approved AWS role",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Deploy the Lambda container and frontend after checks pass",
  ],
  [
    "deployment runs",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Deploy the Lambda container and frontend after checks pass",
  ],
  [
    "the backend image is pushed to ECR",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Deploy the Lambda container and frontend after checks pass",
  ],
  [
    "the Lambda/API deployment is updated",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Deploy the Lambda container and frontend after checks pass",
  ],
  [
    "the frontend hosting deployment is updated",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Deploy the Lambda container and frontend after checks pass",
  ],
  [
    "the AWS deployment has completed",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run deployed smoke tests after deployment",
  ],
  [
    "post-deployment smoke tests run",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run deployed smoke tests after deployment",
  ],
  [
    "health checks pass",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run deployed smoke tests after deployment",
  ],
  [
    "deployed PDF extraction is verified",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run deployed smoke tests after deployment",
  ],
  [
    "the Realtime token route contract is verified without printing secrets",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Run deployed smoke tests after deployment",
  ],
  [
    "repository workflow configuration is inspected",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Avoid storing long-lived AWS keys in GitHub Actions",
  ],
  [
    "no long-lived AWS access key or secret key is configured",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Avoid storing long-lived AWS keys in GitHub Actions",
  ],
  [
    "the deploy role trust policy is restricted to the approved repository and ref",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Avoid storing long-lived AWS keys in GitHub Actions",
  ],
  [
    "the deployment IAM policy is inspected",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Grant least-privilege AWS deployment permissions",
  ],
  [
    "permissions are limited to the selected ECR, Lambda, API, hosting, storage, and logging resources",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Grant least-privilege AWS deployment permissions",
  ],
  [
    "unrelated AWS services are not granted",
    "Requires executed workflow evidence or configuration assertions not yet implemented. ci-cd.feature: Grant least-privilege AWS deployment permissions",
  ],
  [
    "the repository is reviewed",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Verify the repository has modular frontend and backend code",
  ],
  [
    "frontend, domain, provider, test, and infrastructure boundaries are identifiable",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Verify the repository has modular frontend and backend code",
  ],
  [
    "the backend can be packaged as a Docker image",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Verify the repository has modular frontend and backend code",
  ],
  [
    "all required checks have passed",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Verify the release is present on main",
  ],
  [
    "the release is finalized",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Verify the release is present on main",
  ],
  [
    "the approved implementation is merged or pushed to the `main` branch",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Verify the release is present on main",
  ],
  [
    "the repository contains the corresponding tests and documentation",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Verify the release is present on main",
  ],
  [
    "the production deployment has succeeded",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Provide a publicly hosted working web application",
  ],
  [
    "a reviewer opens the published URL",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Provide a publicly hosted working web application",
  ],
  [
    "the mobile-first web application loads",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Provide a publicly hosted working web application",
  ],
  [
    "a PDF or supported YouTube URL can be ingested",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Provide a publicly hosted working web application",
  ],
  [
    "the conversation flow can be demonstrated",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Provide a publicly hosted working web application",
  ],
  [
    "a reviewer has the walkthrough instructions",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Demonstrate the complete product workflow",
  ],
  [
    "the reviewer follows the 10-15 minute demo",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Demonstrate the complete product workflow",
  ],
  [
    "the reviewer can select a source",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Demonstrate the complete product workflow",
  ],
  [
    "inspect the extracted preview",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Demonstrate the complete product workflow",
  ],
  [
    "start a voice conversation",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Demonstrate the complete product workflow",
  ],
  [
    "interrupt, mute, unmute, and stop it",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Demonstrate the complete product workflow",
  ],
  [
    "use text fallback when voice is unavailable",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Demonstrate the complete product workflow",
  ],
  [
    "the release checklist is completed",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Review required edge cases before release",
  ],
  [
    "PDF size, file type, empty extraction, invalid URL, unavailable captions, and cloud blocking cases are reviewed",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Review required edge cases before release",
  ],
  [
    "poor-network, permission, reconnect, security, and mobile states are reviewed",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Review required edge cases before release",
  ],
  [
    "the assessment has a seven-business-day deadline",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Track the assessment delivery timeline",
  ],
  [
    "milestones are reviewed",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Track the assessment delivery timeline",
  ],
  [
    "foundation, ingestion, conversation, mobile, deployment, and final documentation milestones are tracked",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Track the assessment delivery timeline",
  ],
  [
    "the final delivery is reviewed",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Confirm required external setup is recorded",
  ],
  [
    "the GitHub repository and main-branch access are recorded",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Confirm required external setup is recorded",
  ],
  [
    "the AWS account and region are recorded",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Confirm required external setup is recorded",
  ],
  [
    "the OIDC repository/environment scope is recorded",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Confirm required external setup is recorded",
  ],
  [
    "the provider secret and optional transcript configuration are recorded",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Confirm required external setup is recorded",
  ],
  [
    "Android SDK/AVD readiness is recorded when Android coverage is required",
    "Release/reviewer evidence or repository assertions not yet implemented. delivery.feature: Confirm required external setup is recorded",
  ],
  [
    "a new developer follows the README",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Follow the README to run the complete project locally",
  ],
  [
    "the developer can start the Compose environment",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Follow the README to run the complete project locally",
  ],
  [
    "the developer can run the web application locally",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Follow the README to run the complete project locally",
  ],
  [
    "the developer can run the local acceptance tests",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Follow the README to run the complete project locally",
  ],
  [
    "I read the configuration documentation",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find environment variables and secret configuration guidance",
  ],
  [
    "required local variables are listed",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find environment variables and secret configuration guidance",
  ],
  [
    "server-only secrets are clearly identified",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find environment variables and secret configuration guidance",
  ],
  [
    "production secrets are directed to the approved AWS secret mechanism",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find environment variables and secret configuration guidance",
  ],
  [
    "I read the technical overview",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find architecture and trade-off explanations",
  ],
  [
    "frontend, backend, provider, storage, and infrastructure boundaries are explained",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find architecture and trade-off explanations",
  ],
  [
    "Lambda container deployment is compared with ECS",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find architecture and trade-off explanations",
  ],
  [
    "the cheapest suitable demo choice is stated",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find architecture and trade-off explanations",
  ],
  [
    "I read the ingestion documentation",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the YouTube cloud limitation and local workaround",
  ],
  [
    "the YouTube transcript provider limitation is explained",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the YouTube cloud limitation and local workaround",
  ],
  [
    "the deterministic local transcript fallback is documented",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the YouTube cloud limitation and local workaround",
  ],
  [
    "deployed retrieval behavior is documented if enabled",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the YouTube cloud limitation and local workaround",
  ],
  [
    "I read the project documentation",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the AI-use disclosure",
  ],
  [
    "AI-assisted work and its role in the implementation are disclosed",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the AI-use disclosure",
  ],
  [
    "I read the delivery documentation",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the 10-15 minute walkthrough script",
  ],
  [
    "a walkthrough script covers source ingestion, preview, voice, fallback, tests, and deployment decisions",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find the 10-15 minute walkthrough script",
  ],
  [
    "I read the project commands section",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find test and deployment commands",
  ],
  [
    "local, unit, Gherkin, browser, simulator, Docker, and deployment commands are documented",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find test and deployment commands",
  ],
  [
    "I read the mobile development documentation",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find simulator setup instructions",
  ],
  [
    "iOS simulator setup is documented",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find simulator setup instructions",
  ],
  [
    "Android SDK, emulator, host gateway, and port forwarding setup are documented",
    "Local documentation assertions not yet implemented; this remains a failing local gate. documentation.feature: Find simulator setup instructions",
  ],
  [
    "the deployed transcript provider blocks the cloud request",
    "Requires deployed provider restriction and documented fallback evidence. ingestion.feature: Report cloud transcript blocking and provide local fallback guidance",
  ],
  [
    "I submit a supported YouTube URL",
    "Requires deployed provider restriction and documented fallback evidence. ingestion.feature: Report cloud transcript blocking and provide local fallback guidance",
  ],
  [
    "I see a useful provider limitation error",
    "Requires deployed provider restriction and documented fallback evidence. ingestion.feature: Report cloud transcript blocking and provide local fallback guidance",
  ],
  [
    "I am directed to the documented local demonstration fallback",
    "Requires deployed provider restriction and documented fallback evidence. ingestion.feature: Report cloud transcript blocking and provide local fallback guidance",
  ],
  [
    "I run `docker compose up --build`",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Start every local service with Docker Compose",
  ],
  [
    "the web service starts",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Start every local service with Docker Compose",
  ],
  [
    "the API service starts",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Start every local service with Docker Compose",
  ],
  [
    "the object-store service starts",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Start every local service with Docker Compose",
  ],
  [
    "the transcript-mock service starts",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Start every local service with Docker Compose",
  ],
  [
    "the realtime-mock service starts",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Start every local service with Docker Compose",
  ],
  [
    "`PROVIDER_MODE=mock`",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run a mocked Realtime conversation without external credentials",
  ],
  [
    "I upload the deterministic fixture PDF through the local web app",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Ingest a fixture PDF without external credentials",
  ],
  [
    "PDF text extraction succeeds",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Ingest a fixture PDF without external credentials",
  ],
  [
    "no external provider credential is required",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Ingest a fixture YouTube transcript without external credentials",
  ],
  [
    "I submit a fixture YouTube URL through the local web app",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Ingest a fixture YouTube transcript without external credentials",
  ],
  [
    "the transcript mock returns deterministic transcript text",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Ingest a fixture YouTube transcript without external credentials",
  ],
  [
    "I start voice chat with the realtime mock",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run a mocked Realtime conversation without external credentials",
  ],
  [
    "a deterministic session is established",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run a mocked Realtime conversation without external credentials",
  ],
  [
    "mock user and assistant events can be exchanged",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run a mocked Realtime conversation without external credentials",
  ],
  [
    "all Compose services are healthy",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the web application against the local API",
  ],
  [
    "I open the web app",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the web application against the local API",
  ],
  [
    "the web client reaches the API over the Compose network",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the web application against the local API",
  ],
  [
    "source ingestion and mock conversation work end to end",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the web application against the local API",
  ],
  [
    "the native client is running on a host simulator",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the native client against the Compose API",
  ],
  [
    "it uses the configured host gateway API URL",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the native client against the Compose API",
  ],
  [
    "it can ingest a fixture source and start mock conversation",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the native client against the Compose API",
  ],
  [
    "`PROVIDER_MODE=live`",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the live provider mode without exposing secrets to the web container",
  ],
  [
    "the API is started with a server-side provider secret",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the live provider mode without exposing secrets to the web container",
  ],
  [
    "the API can call the configured external provider",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the live provider mode without exposing secrets to the web container",
  ],
  [
    "the browser never receives that long-lived secret",
    "Compose/native/live integration assertions not yet implemented. local-environment.feature: Run the live provider mode without exposing secrets to the web container",
  ],
  [
    "an iOS simulator is booted",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Launch the iOS client against the local API",
  ],
  [
    "I launch the native client with the host API URL",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Launch the Android client against the local API",
  ],
  [
    "the application starts successfully",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Launch the Android client against the local API",
  ],
  [
    "the source selection screen is visible",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Launch the Android client against the local API",
  ],
  [
    "an Android emulator is booted and configured with the host gateway",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Launch the Android client against the local API",
  ],
  [
    "the native client is running on a simulator",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Select a PDF from the simulator test fixture",
  ],
  [
    "I select the supplied PDF fixture",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Select a PDF from the simulator test fixture",
  ],
  [
    "the PDF is sent to the local API",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Select a PDF from the simulator test fixture",
  ],
  [
    "ingestion progress and completion are visible",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Select a PDF from the simulator test fixture",
  ],
  [
    "a simulator PDF ingestion has completed",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Display extracted text on the simulator",
  ],
  [
    "I open the source preview",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Display extracted text on the simulator",
  ],
  [
    "extracted text is readable on the mobile screen",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Display extracted text on the simulator",
  ],
  [
    "the preview can be expanded and collapsed",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Display extracted text on the simulator",
  ],
  [
    "the native client is using the realtime mock",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Start and stop a mock voice conversation on the simulator",
  ],
  [
    "I start and then stop a voice conversation",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Start and stop a mock voice conversation on the simulator",
  ],
  [
    "the simulator shows preparing, connected, and disconnected states",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Start and stop a mock voice conversation on the simulator",
  ],
  [
    "microphone resources are released on stop",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Start and stop a mock voice conversation on the simulator",
  ],
  [
    "microphone access is unavailable or denied on the simulator",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Use text fallback on the simulator",
  ],
  [
    "I choose text fallback",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Use text fallback on the simulator",
  ],
  [
    "I can submit a question",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Use text fallback on the simulator",
  ],
  [
    "the assistant response is displayed",
    "Requires native simulator UI automation; Chromium is not simulator evidence. mobile-smoke.feature: Use text fallback on the simulator",
  ],
  [
    'I select "Start Voice Chat"',
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Start a voice chat and establish WebRTC",
  ],
  [
    "the client requests a Realtime session from the backend",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Start a voice chat and establish WebRTC",
  ],
  [
    "the browser establishes a WebRTC connection",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Start a voice chat and establish WebRTC",
  ],
  [
    'the connection status becomes "Connected"',
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Start a voice chat and establish WebRTC",
  ],
  [
    "the client requests a Realtime session",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Return only an ephemeral Realtime token to the client",
  ],
  [
    "the backend authenticates server-side with the Realtime provider",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Receive a short-lived ephemeral token from the backend",
  ],
  [
    "the client receives only a short-lived ephemeral token",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Receive a short-lived ephemeral token from the backend",
  ],
  [
    "the voice session is connected",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Stop the session and release the microphone",
  ],
  [
    "I speak a question",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Speak a question and see the user transcript",
  ],
  [
    "microphone audio is sent through the WebRTC session",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Speak a question and see the user transcript",
  ],
  [
    "my transcript appears in the conversation in real time",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Speak a question and see the user transcript",
  ],
  [
    "the assistant responds to my question",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Hear a spoken assistant response",
  ],
  [
    "a remote audio track is received",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Hear a spoken assistant response",
  ],
  [
    "I hear the spoken assistant response",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Hear a spoken assistant response",
  ],
  [
    "the assistant response transcript events arrive",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: See assistant transcript events in real time",
  ],
  [
    "the assistant response appears incrementally in the conversation",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: See assistant transcript events in real time",
  ],
  [
    "the final response is shown in chronological order",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: See assistant transcript events in real time",
  ],
  [
    "I have received an answer in the active session",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Ask a follow-up question using the same source context",
  ],
  [
    "I ask a follow-up question",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Ask a follow-up question using the same source context",
  ],
  [
    "the follow-up is sent in the same conversation",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Ask a follow-up question using the same source context",
  ],
  [
    "the source context remains available to the assistant",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Ask a follow-up question using the same source context",
  ],
  [
    "the assistant is speaking",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Interrupt an assistant response by speaking",
  ],
  [
    "I begin speaking",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Interrupt an assistant response by speaking",
  ],
  [
    "the assistant audio is interrupted",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Interrupt an assistant response by speaking",
  ],
  [
    "the new user turn is processed",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Interrupt an assistant response by speaking",
  ],
  [
    "I select mute",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Mute the microphone",
  ],
  [
    "the local microphone track is disabled",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Mute the microphone",
  ],
  [
    "no microphone audio is sent while muted",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Mute the microphone",
  ],
  [
    "the UI shows the muted state",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Mute the microphone",
  ],
  [
    "the microphone is muted",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Unmute the microphone",
  ],
  [
    "I select unmute",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Unmute the microphone",
  ],
  [
    "the local microphone track is enabled",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Unmute the microphone",
  ],
  [
    "the UI shows the active microphone state",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Unmute the microphone",
  ],
  [
    "I select stop",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Stop the session and release the microphone",
  ],
  [
    "the WebRTC connection is closed",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Stop the session and release the microphone",
  ],
  [
    "microphone access is released",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Stop the session and release the microphone",
  ],
  [
    'the connection status becomes "Disconnected"',
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Stop the session and release the microphone",
  ],
  [
    "I start a voice chat",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Show connecting and connected status",
  ],
  [
    'the UI shows "Preparing" or "Connecting" while setup is in progress',
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Show connecting and connected status",
  ],
  [
    'the UI shows "Connected" only after WebRTC is established',
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Show connecting and connected status",
  ],
  [
    "I am starting or using a voice session",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Handle a Realtime connection failure",
  ],
  [
    "the Realtime connection fails",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Handle a Realtime connection failure",
  ],
  [
    "the UI shows a clear connection error",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Handle a Realtime connection failure",
  ],
  [
    "the text fallback remains available",
    "Requires real WebRTC media/provider integration; mock does not establish WebRTC. realtime.feature: Handle a Realtime connection failure",
  ],
  [
    "a voice session was connected",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Reconnect after a temporary WebRTC interruption",
  ],
  [
    "the WebRTC connection is temporarily interrupted",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Reconnect after a temporary WebRTC interruption",
  ],
  [
    "the UI enters a reconnecting state",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Reconnect after a temporary WebRTC interruption",
  ],
  [
    "the client attempts recovery",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Reconnect after a temporary WebRTC interruption",
  ],
  [
    "the UI returns to connected when recovery succeeds",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Reconnect after a temporary WebRTC interruption",
  ],
  [
    "the conversation contains transcript turns",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Preserve the visible transcript during reconnect",
  ],
  [
    "the realtime connection is interrupted",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Preserve the visible transcript during reconnect",
  ],
  [
    "all visible transcript turns remain available",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Preserve the visible transcript during reconnect",
  ],
  [
    "a voice session is connected",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Display a degraded-network status",
  ],
  [
    "network quality degrades",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Display a degraded-network status",
  ],
  [
    "the UI shows a degraded or reconnecting status",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Display a degraded-network status",
  ],
  [
    "the user receives a clear recovery message",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Display a degraded-network status",
  ],
  [
    "an ingestion or session request times out",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Allow the user to retry after a backend timeout",
  ],
  [
    "the timeout error is displayed",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Allow the user to retry after a backend timeout",
  ],
  [
    "a retry action is offered",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Allow the user to retry after a backend timeout",
  ],
  [
    "the application does not show a false success state",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Allow the user to retry after a backend timeout",
  ],
  [
    "extraction fails after a source is submitted",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Avoid claiming success when extraction fails",
  ],
  [
    "the result is rendered",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Avoid claiming success when extraction fails",
  ],
  [
    "the source is not marked ready",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Avoid claiming success when extraction fails",
  ],
  [
    "starting a voice session is disabled",
    "Local connection fault-injection assertions not yet implemented. resilience.feature: Avoid claiming success when extraction fails",
  ],
  [
    "the production client bundle is inspected",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Keep the OpenAI API key out of client bundles",
  ],
  [
    "the OpenAI API key is absent",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Keep the OpenAI API key out of client bundles",
  ],
  [
    "the key is not returned by any browser-facing response",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Keep the OpenAI API key out of client bundles",
  ],
  [
    "the production client bundle and browser responses are inspected",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Keep AWS credentials out of client bundles",
  ],
  [
    "long-lived AWS credentials are absent",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Keep AWS credentials out of client bundles",
  ],
  [
    "the backend keeps the provider API key server-side",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Return only an ephemeral Realtime token to the client",
  ],
  [
    "the response contains only the short-lived session credential and required session data",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Return only an ephemeral Realtime token to the client",
  ],
  [
    "a PDF is stored temporarily during processing",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Expire or clean up temporary uploaded objects",
  ],
  [
    "the retention period expires or processing completes",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Expire or clean up temporary uploaded objects",
  ],
  [
    "the temporary object is deleted or becomes inaccessible",
    "Production credential-canary, provider-authentication, or storage lifecycle evidence not implemented. security.feature: Expire or clean up temporary uploaded objects",
  ],
  [
    "the session changes between idle, preparing, connecting, connected, reconnecting, ended, and error",
    "Local UI lifecycle instrumentation not yet implemented. ui.feature: Show connection status throughout the session lifecycle",
  ],
  [
    "the UI displays the corresponding status",
    "Local UI lifecycle instrumentation not yet implemented. ui.feature: Show connection status throughout the session lifecycle",
  ],
  [
    "controls match the current session state",
    "Local UI lifecycle instrumentation not yet implemented. ui.feature: Show connection status throughout the session lifecycle",
  ],
];
