import assert from "node:assert/strict";
import {
  llmsText,
  robotsPolicy,
  sitemapEntries,
  structuredData,
  type SiteProfile,
} from "../../packages/core/src/domain/discoverability";
import { siteProfile } from "../../apps/web/app/seo/profile";
import type { Step, World } from "./steps";

type Node = Record<string, unknown>;

/** A sample id shaped like YouTube's, never pointing at a real video. */
const SAMPLE_YOUTUBE_ID = "ursly_intro0";

function nodeOfType(graph: readonly unknown[], type: string): Node | undefined {
  return graph.find((node) => (node as Node)["@type"] === type) as
    | Node
    | undefined;
}

export function registerDiscoverabilityChecks(step: Step) {
  const states = new WeakMap<
    World,
    { graph: readonly unknown[]; profile: SiteProfile; text: string }
  >();

  function describe(self: World, language: "en" | "fr") {
    const profile = siteProfile(language);
    states.set(self, {
      profile,
      graph: structuredData(profile, language),
      text: "",
    });
  }

  step("the introduction is published on YouTube", function () {
    process.env.INTRO_VIDEO_YOUTUBE_ID_EN = SAMPLE_YOUTUBE_ID;
  });

  step("the introduction is not published on YouTube", function () {
    delete process.env.INTRO_VIDEO_YOUTUBE_ID_EN;
  });

  step("the English page describes itself to a crawler", function () {
    describe(this, "en");
  });

  step("the French page describes itself to a crawler", function () {
    describe(this, "fr");
  });

  step("the organization, the site and the application are named", function () {
    const { graph, profile } = states.get(this)!;
    assert.equal(nodeOfType(graph, "Organization")?.name, profile.name);
    assert.equal(nodeOfType(graph, "WebSite")?.inLanguage, "en");
    assert.ok(nodeOfType(graph, "SoftwareApplication")?.applicationCategory);
  });

  step(
    "the introduction is described with its duration and its transcript",
    function () {
      const video = nodeOfType(states.get(this)!.graph, "VideoObject");
      assert.equal(video?.duration, "PT24S");
      assert.match(
        String(video?.transcript),
        /Internet without a keyboard and a mouse\./,
      );
      assert.ok(video?.uploadDate, "a video without an upload date is ignored");
    },
  );

  step("the introduction links to its page on YouTube", function () {
    const video = nodeOfType(states.get(this)!.graph, "VideoObject");
    assert.equal(
      video?.url,
      `https://www.youtube.com/watch?v=${SAMPLE_YOUTUBE_ID}`,
    );
    delete process.env.INTRO_VIDEO_YOUTUBE_ID_EN;
  });

  step("the introduction links to the file this origin serves", function () {
    const video = nodeOfType(states.get(this)!.graph, "VideoObject");
    assert.equal(video?.url, undefined);
    assert.match(String(video?.contentUrl), /\/brand\/ursly-intro\.en\.mp4$/);
  });

  step("the introduction is described in French", function () {
    const video = nodeOfType(states.get(this)!.graph, "VideoObject");
    assert.equal(video?.inLanguage, "fr");
    assert.match(
      String(video?.transcript),
      /Internet sans clavier ni souris\./,
    );
  });

  step("the sitemap is built", function () {
    const profile = siteProfile();
    states.set(this, {
      profile,
      graph: [],
      text: llmsText(profile),
    });
  });

  step(
    "each language of the home page is listed with its translations",
    function () {
      const entries = sitemapEntries(states.get(this)!.profile);
      assert.deepEqual(
        entries.map((entry) => entry.url),
        ["https://ursly.io/en", "https://ursly.io/fr"],
      );
      for (const entry of entries)
        assert.equal(
          entry.alternates.languages["x-default"],
          "https://ursly.io/en",
        );
    },
  );

  step(
    "the crawling policy welcomes crawlers and keeps the API out",
    function () {
      const policy = robotsPolicy(states.get(this)!.profile);
      assert.deepEqual(policy.rules[0]?.allow, ["/"]);
      assert.deepEqual(policy.rules[0]?.disallow, ["/api/"]);
      assert.equal(policy.sitemap, "https://ursly.io/sitemap.xml");
    },
  );

  step("a model reads the plain text summary", function () {
    const profile = siteProfile();
    states.set(this, { profile, graph: [], text: llmsText(profile) });
  });

  step(
    "it finds the product, its pages and the words of the introduction",
    function () {
      const text = states.get(this)!.text;
      assert.match(text, /^# Ursly/);
      assert.match(text, /https:\/\/ursly\.io\/fr/);
      assert.match(text, /It is simply no longer the way in\./);
      assert.match(text, /plus la porte d\u2019entrée\./);
    },
  );
}
