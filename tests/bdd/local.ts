import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { After } from "@cucumber/cucumber";
import { expect, type Page } from "@playwright/test";
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Step, World } from "./steps";
import { fixturePdf } from "./fixtures";

const exec = promisify(execFile);
type Action = (this: World) => Promise<void>;
type Helpers = {
  page: (w: World) => Promise<Page>;
  open: Action;
  ready: Action;
  youtube: Action;
  send: Action;
  session: Action;
  upload: (this: World, bytes: Buffer) => Promise<void>;
  baseURL: string;
};
type State = {
  docs?: string;
  services?: Record<string, unknown>[];
  assets?: string;
  responses?: string;
  key?: string;
  bucket?: string;
  s3?: S3Client;
  iam?: string;
};
const states = new WeakMap<World, State>();
function state(w: World) {
  let s = states.get(w);
  if (!s) {
    s = {};
    states.set(w, s);
  }
  return s;
}
async function docs(w: World) {
  state(w).docs = (
    await Promise.all(
      [
        "README.md",
        "WALKTHROUGH.md",
        "infrastructure/terraform/README.md",
        "apps/mobile/README.md",
        "services/transcript/README.md",
      ].map((p) => readFile(p, "utf8")),
    )
  ).join("\n");
}
function contains(w: World, ...patterns: RegExp[]) {
  assert.ok(state(w).docs, "Read the relevant documentation first");
  for (const pattern of patterns) assert.match(state(w).docs!, pattern);
}
async function compose(w: World) {
  await exec("docker", ["compose", "config", "--quiet"]);
  const { stdout } = await exec("docker", [
    "compose",
    "ps",
    "--format",
    "json",
  ]);
  state(w).services = stdout.trim().startsWith("[")
    ? JSON.parse(stdout)
    : stdout
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
  for (const name of ["web", "transcript", "object-store"]) {
    const service = state(w).services!.find((s) => s.Service === name);
    assert.ok(service, `${name} must exist in the running Compose stack`);
    assert.equal(service.State, "running");
    assert.equal(service.Health, "healthy");
  }
}
async function json(url: string) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} health failed`);
  return response.json();
}

export function registerLocalChecks(step: Step, h: Helpers) {
  step(
    [
      "the documented Compose stack has been started",
      "all Compose services are healthy",
      "the developer can start the Compose environment",
    ],
    async function () {
      await compose(this);
    },
  );
  step("the web service starts", async function () {
    await h.open.call(this);
    await expect(
      (await h.page(this)).getByRole("heading", {
        name: "Less scrolling. More understanding.",
      }),
    ).toBeVisible();
  });
  step("the API service starts", async function () {
    assert.equal((await json(`${h.baseURL}/api/health`)).ok, true);
  });
  step("the object-store service starts", async function () {
    assert.equal(
      (
        await fetch(
          process.env.BDD_OBJECT_STORE_URL ??
            "http://localhost:9002/minio/health/live",
        )
      ).status,
      200,
    );
  });
  step("the Python transcript service starts in mock mode", async function () {
    assert.equal(
      (
        await json(
          process.env.BDD_TRANSCRIPT_HEALTH_URL ??
            "http://localhost:3010/health",
        )
      ).mode,
      "mock",
    );
  });
  step(
    "the application provides in-process simulated sessions",
    async function () {
      await h.ready.call(this);
      await h.session.call(this);
      assert.equal(this.body.mode, "mock");
    },
  );
  step(
    "a fresh browser session without stored login credentials",
    async function () {
      const p = await h.page(this);
      assert.deepEqual(await p.context().cookies(), []);
      await h.open.call(this);
      assert.equal(await p.evaluate(() => localStorage.length), 0);
    },
  );
  step("I ingest a source and ask a text question", async function () {
    await h.ready.call(this);
    await h.send.call(this);
  });
  step(
    "ingestion and conversation succeed without a login prompt",
    async function () {
      const p = await h.page(this);
      await expect(p.locator(".message.assistant .message-text")).toBeVisible();
      await expect(
        p.getByRole("button", { name: /sign in|log in|register/i }),
      ).toHaveCount(0);
      assert.deepEqual(await p.context().cookies(), []);
    },
  );
  step("`PROVIDER_MODE=mock`", async function () {
    assert.equal((await json(`${h.baseURL}/api/health`)).mode, "mock");
    await h.open.call(this);
  });
  step(
    "I upload the deterministic fixture PDF through the local web app",
    async function () {
      await h.upload.call(
        this,
        fixturePdf(["Local Compose fixture evidence."]),
      );
    },
  );
  step("PDF text extraction succeeds", function () {
    assert.equal(this.status, 200);
    assert.match(this.source.text, /Local Compose fixture evidence/);
  });
  step("I submit a fixture YouTube URL through the local web app", h.youtube);
  step(
    "the transcript mock returns deterministic transcript text",
    function () {
      assert.equal(this.status, 200);
      assert.equal(
        this.source.text,
        "This is a deterministic local transcript. It is available for local BDD and simulator testing.",
      );
    },
  );
  step("no external provider credential is required", async function () {
    // Inspect booleans inside the server, never print credential values.
    const { stdout } = await exec("docker", [
      "compose",
      "exec",
      "-T",
      "web",
      "node",
      "-e",
      'console.log(JSON.stringify({mock:process.env.PROVIDER_MODE==="mock",transcript:process.env.TRANSCRIPT_SERVICE_URL?.startsWith("http://transcript:")}))',
    ]);
    assert.deepEqual(JSON.parse(stdout), { mock: true, transcript: true });
    assert.equal(this.status, 200);
  });
  step("I start voice chat with the realtime mock", async function () {
    await h.ready.call(this);
    await (await h.page(this))
      .getByRole("button", { name: "Start Voice Chat" })
      .click();
  });
  step("a deterministic session is established", async function () {
    await expect(
      (await h.page(this)).locator(".conversation-card .status"),
    ).toHaveText("Connected");
  });
  step("mock user and assistant events can be exchanged", async function () {
    const p = await h.page(this);
    await p.getByLabel("Ask a question").fill("Summarize this source");
    await p.getByRole("button", { name: "Send", exact: true }).click();
    await expect(p.locator(".message.user .message-text")).toHaveText(
      "Summarize this source",
    );
    await expect(p.locator(".message.assistant .message-text")).toContainText(
      this.source.text.slice(0, 160),
    );
  });
  step(
    ["I open the web app", "the developer can run the web application locally"],
    h.open,
  );
  step(
    "the web client reaches the API over the Compose network",
    async function () {
      const { stdout } = await exec("docker", [
        "compose",
        "exec",
        "-T",
        "web",
        "node",
        "-e",
        'fetch("http://transcript:3010/health").then(async r=>{if(!r.ok)process.exit(1);console.log(JSON.stringify(await r.json()))})',
      ]);
      assert.equal(JSON.parse(stdout).status, "ok");
      await h.ready.call(this);
      assert.equal(this.source.kind, "youtube");
    },
  );
  step(
    "source ingestion and mock conversation work end to end",
    async function () {
      await h.send.call(this);
      assert.deepEqual(this.requestBody.source, this.source);
    },
  );

  step(
    [
      "a new developer follows the README",
      "I read the configuration documentation",
      "I read the technical overview",
      "I read the ingestion documentation",
      "I read the project documentation",
      "I read the delivery documentation",
      "I read the project commands section",
      "I read the mobile development documentation",
    ],
    async function () {
      await docs(this);
    },
  );
  step("the developer can run the local acceptance tests", async function () {
    contains(
      this,
      /npm run test:gherkin/,
      /pending steps are not passing|pending.*cannot|étapes.*en attente.*échouer/i,
    );
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    assert.match(pkg.scripts["test:gherkin"], /cucumber-js/);
    const config = await readFile("cucumber.js", "utf8");
    assert.match(config, /strict:\s*true/);
    // Execute one actual application journey, without recursively running Cucumber.
    await h.ready.call(this);
    await h.send.call(this);
    assert.deepEqual(this.requestBody.source, this.source);
  });
  step("required local variables are listed", function () {
    contains(
      this,
      /PROVIDER_MODE/,
      /TRANSCRIPT_MODE/,
      /TRANSCRIPT_SERVICE_URL/,
      /OPENAI_API_KEY/,
    );
  });
  step("server-only secrets are clearly identified", function () {
    contains(
      this,
      /server.*key|server-only/i,
      /NEXT_PUBLIC_/,
      /never.*secret|secret.*never/i,
    );
  });
  step(
    "production secrets are directed to the approved AWS secret mechanism",
    function () {
      contains(this, /Secrets Manager/, /OPENAI_SECRET_ARN/);
    },
  );
  step(
    "frontend, backend, provider, storage, and infrastructure boundaries are explained",
    function () {
      contains(
        this,
        /Next.js/,
        /Server routes|routes serveur/,
        /provider/,
        /S3/,
        /Lambda/,
      );
    },
  );
  step("Lambda container deployment is compared with ECS", function () {
    contains(this, /Lambda/, /always-on ECS|always-running ECS/);
  });
  step("the cheapest suitable demo choice is stated", function () {
    contains(
      this,
      /default runtime is Lambda|Lambda est le choix par défaut/,
      /intermittent/,
    );
  });
  step("the YouTube transcript provider limitation is explained", function () {
    contains(this, /cloud.*IP|IP.*limitation/i);
  });
  step(
    "the deterministic local transcript fallback is documented",
    function () {
      contains(
        this,
        /deterministic.*mock|mock.*deterministic/i,
        /TRANSCRIPT_MODE/,
      );
    },
  );
  step("deployed retrieval behavior is documented if enabled", function () {
    contains(this, /TRANSCRIPT_SERVICE_URL/, /block|limitation/i);
  });
  step(
    "AI-assisted work and its role in the implementation are disclosed",
    function () {
      contains(
        this,
        /AI-assisted development|assistance IA/,
        /requirements decomposition|décomposition des exigences/,
        /debugging|débogage/,
      );
    },
  );
  step(
    "a walkthrough script covers source ingestion, preview, voice, fallback, tests, and deployment decisions",
    async function () {
      const script = await readFile("WALKTHROUGH.md", "utf8");
      for (const pattern of [
        /12-minute/,
        /PDF ingestion/,
        /YouTube ingestion/,
        /preview/,
        /Live voice/,
        /Fallback/,
        /unit tests/,
        /OIDC/,
      ])
        assert.match(script, pattern);
    },
  );
  step(
    "local, unit, Gherkin, browser, simulator, Docker, and deployment commands are documented",
    function () {
      contains(
        this,
        /npm test/,
        /test:gherkin/,
        /test:e2e/,
        /npm run ios/,
        /npm run android/,
        /docker compose/,
        /terraform.*apply/,
      );
    },
  );
  step("iOS simulator setup is documented", function () {
    contains(this, /npm run ios/, /ios-boot/, /development build/);
  });
  step(
    "Android SDK, emulator, host gateway, and port forwarding setup are documented",
    function () {
      contains(
        this,
        /Android SDK|SDK Android/,
        /10\.0\.2\.2/,
        /adb(?:\s+-s\s+\S+)?\s+reverse/,
        /npm run android/,
      );
    },
  );

  step("a PDF is stored temporarily during processing", async function () {
    const bytes = fixturePdf(["Storage lifecycle evidence."]);
    const prepared = await fetch(`${h.baseURL}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "lifecycle.pdf",
        type: "application/pdf",
        size: bytes.length,
      }),
    });
    assert.equal(prepared.status, 200);
    const signed = await prepared.json();
    const form = new FormData();
    for (const [k, v] of Object.entries(signed.fields))
      form.append(k, String(v));
    form.append(
      "file",
      new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      "lifecycle.pdf",
    );
    const uploaded = await fetch(signed.url, { method: "POST", body: form });
    assert.ok(uploaded.ok, `Object upload returned ${uploaded.status}`);
    const s = state(this);
    s.key = signed.key;
    s.bucket = signed.fields.bucket;
    s.s3 = new S3Client({
      endpoint: process.env.BDD_S3_ENDPOINT ?? "http://localhost:9002",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: "local-minio",
        secretAccessKey: "local-minio-password",
      },
    });
    const object = await s.s3.send(
      new HeadObjectCommand({ Bucket: s.bucket, Key: s.key }),
    );
    assert.equal(object.ContentLength, bytes.length);
  });
  step(
    "the retention period expires or processing completes",
    async function () {
      const s = state(this);
      const response = await fetch(`${h.baseURL}/api/uploads/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: s.key, name: "lifecycle.pdf" }),
      });
      assert.equal(response.status, 200);
      assert.match(
        (await response.json()).source.text,
        /Storage lifecycle evidence/,
      );
    },
  );
  step(
    "the temporary object is deleted or becomes inaccessible",
    async function () {
      const s = state(this);
      await assert.rejects(
        () =>
          s.s3!.send(new HeadObjectCommand({ Bucket: s.bucket, Key: s.key })),
        (e: unknown) =>
          (e as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404,
      );
    },
  );
  After(async function (this: World) {
    const s = state(this);
    if (s.key && s.s3) {
      await s.s3.send(
        new DeleteObjectCommand({ Bucket: s.bucket, Key: s.key }),
      );
      s.s3.destroy();
    }
  });

  async function inspect(w: World) {
    // The integration build must have been run with these public fake fixtures.
    // The same scanner is regression-tested with intentionally leaking assets.
    await exec(
      process.execPath,
      ["infrastructure/scripts/check-client-secrets.mjs"],
      {
        env: {
          ...process.env,
          OPENAI_API_KEY: "ci_canary_OPENAI_clearlyfakefixture_2026",
          AWS_SECRET_ACCESS_KEY: "ci_canary_AWS_clearlyfakefixture_2026",
        },
      },
    );
    await exec(process.execPath, [
      "--test",
      "infrastructure/tests/client-secrets.test.cjs",
    ]);
    await h.ready.call(w);
    const p = await h.page(w);
    const scripts = await p
      .locator('script[src*="/_next/static/"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).src));
    assert.ok(scripts.length > 0, "Expected production client chunks");
    state(w).assets = (
      await Promise.all(
        scripts.map(async (url) => {
          const r = await fetch(url);
          assert.equal(r.status, 200);
          return r.text();
        }),
      )
    ).join("\n");
    await h.session.call(w);
    const sessionBody = JSON.stringify(w.body);
    await h.send.call(w);
    state(w).responses = [
      sessionBody,
      JSON.stringify(w.requestBody),
      await p.content(),
      JSON.stringify(await json(`${h.baseURL}/api/health`)),
    ].join("\n");
    // Scan every production chunk against actual configured secrets in-container.
    // Only aggregate counts/booleans leave the process; no secret is logged.
    const script =
      'const fs=require("fs"),path=require("path");let count=0,leaked=false;const secrets=[process.env.OPENAI_API_KEY,process.env.AWS_SECRET_ACCESS_KEY,process.env.OBJECT_STORE_SECRET_KEY].filter(Boolean);function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith(".js")){count++;const t=fs.readFileSync(p,"utf8");if(secrets.some(s=>t.includes(s)))leaked=true;}}}walk("/app/apps/web/.next/static");console.log(JSON.stringify({count,leaked}));';
    const { stdout } = await exec("docker", [
      "compose",
      "exec",
      "-T",
      "web",
      "node",
      "-e",
      script,
    ]);
    const scan = JSON.parse(stdout);
    assert.ok(scan.count > 0);
    assert.equal(
      scan.leaked,
      false,
      "Configured server credential found in client chunks",
    );
  }
  step(
    [
      "the production client bundle is inspected",
      "the production client bundle and browser responses are inspected",
    ],
    async function () {
      await inspect(this);
    },
  );
  step("the OpenAI API key is absent", function () {
    assert.doesNotMatch(state(this).assets!, /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
  });
  step("the key is not returned by any browser-facing response", function () {
    assert.doesNotMatch(
      state(this).responses!,
      /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
    );
  });
  step("long-lived AWS credentials are absent", function () {
    for (const text of [state(this).assets!, state(this).responses!]) {
      assert.doesNotMatch(text, /AKIA[A-Z0-9]{16}/);
      assert.ok(!text.includes("local-minio-password"));
    }
  });

  step("repository workflow configuration is inspected", async function () {
    state(this).iam = (
      await Promise.all(
        ["ci.yml", "deploy.yml"].map((f) =>
          readFile(`.github/workflows/${f}`, "utf8"),
        ),
      )
    ).join("\n");
  });
  step("no long-lived AWS access key or secret key is configured", function () {
    const workflow = state(this).iam!.replace(
      /^\s*AWS_SECRET_ACCESS_KEY:\s*ci_canary_AWS_clearlyfakefixture_2026\s*$/gm,
      "",
    );
    assert.doesNotMatch(
      workflow,
      /aws-access-key-id|aws-secret-access-key|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/,
    );
    assert.match(workflow, /role-to-assume/);
    assert.match(workflow, /id-token: write/);
  });
  step(
    "the deploy role trust policy is restricted to the approved repository and ref",
    async function () {
      await exec(
        process.execPath,
        ["--test", "infrastructure/tests/terraform-contract.test.cjs"],
        { timeout: 25000 },
      );
    },
  );
  step("the deployment IAM policy is inspected", async function () {
    state(this).iam = await readFile(
      "infrastructure/terraform/bootstrap/deployment-policy.tf",
      "utf8",
    );
  });
  step(
    "permissions are limited to the selected ECR, Lambda, API, hosting, storage, and logging resources",
    async function () {
      await exec(
        process.execPath,
        ["--test", "infrastructure/tests/terraform-contract.test.cjs"],
        { timeout: 25000 },
      );
    },
  );
  step("unrelated AWS services are not granted", function () {
    const actions = [
      ...state(this).iam!.matchAll(/Action\s*=\s*\[([^\]]+)\]/g),
    ].flatMap((m) =>
      [...m[1].matchAll(/['"]([a-z0-9]+):[^'"]+['"]/g)].map((a) => a[1]),
    );
    assert.ok(actions.length > 10);
    assert.deepEqual(
      [...new Set(actions)].filter(
        (s) =>
          ![
            "s3",
            "secretsmanager",
            "logs",
            "lambda",
            "apigateway",
            "iam",
            "ecr",
            "sts",
          ].includes(s),
      ),
      [],
    );
  });
  step("the repository is reviewed", async function () {
    for (const path of [
      "apps/web/app/page.tsx",
      "packages/core/src/domain/ingestion.ts",
      "packages/adapters/src/providers.ts",
      "tests/bdd/steps.ts",
      "infrastructure/terraform/modules/demo/main.tf",
    ])
      await access(path);
  });
  step(
    "frontend, domain, provider, test, and infrastructure boundaries are identifiable",
    async function () {
      const client = await readFile("apps/web/app/page.tsx", "utf8");
      assert.match(client, /use client/);
      assert.doesNotMatch(client, /from ["'][^"']*server\//);
    },
  );
  step("the backend can be packaged as a Docker image", async function () {
    const { stdout } = await exec("docker", [
      "compose",
      "images",
      "--format",
      "json",
      "web",
    ]);
    assert.ok(
      stdout.includes("web"),
      "Running web must have a built Docker image",
    );
  });
  step("the local edge-case review is inspected", async function () {
    state(this).docs = await readFile("LOCAL_REVIEW.md", "utf8");
    assert.match(
      state(this).docs!,
      /\|\s*Case\s*\|\s*Evidence reviewed\s*\|\s*Disposition\s*\|/i,
    );
    // Validate cited artifacts exist; do not reinterpret pending evidence as pass.
    for (const reference of state(this).docs!.matchAll(
      /`([^`]+\.(?:ts|py|mjs|feature|md))`/g,
    )) {
      await access(reference[1]);
    }
  });
  function recorded(w: World, cases: RegExp[]) {
    const rows = state(w)
      .docs!.split("\n")
      .filter((line) => line.trim().startsWith("|"))
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    for (const topic of cases) {
      const row = rows.find((cells) => topic.test(cells[0] ?? ""));
      assert.ok(row, `Missing edge-case review row: ${topic}`);
      assert.ok(row[1]?.length > 8, `Missing evidence for ${row[0]}`);
      assert.match(
        row[2] ?? "",
        /passed|tested|covered|pending|required|rerun|added|fixed|failed/i,
        `Missing tested or pending disposition for ${row[0]}`,
      );
    }
  }
  step(
    "PDF size, file type, empty extraction, invalid URL, unavailable captions, and cloud blocking have recorded evidence and dispositions",
    function () {
      recorded(this, [
        /PDF size/i,
        /file type/i,
        /empty.*PDF|extractable/i,
        /invalid URL/i,
        /unavailable captions/i,
        /cloud.*block/i,
      ]);
    },
  );
  step(
    "poor-network, permission, reconnect, security, and mobile have recorded evidence and dispositions",
    function () {
      recorded(this, [
        /poor.network/i,
        /permission/i,
        /reconnect/i,
        /security/i,
        /mobile/i,
      ]);
    },
  );
}
