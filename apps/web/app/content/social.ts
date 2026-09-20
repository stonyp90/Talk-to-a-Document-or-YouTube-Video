import { repositoryUrl } from "./downloads";
import type { BrandIconName } from "../components/BrandIcon";

/**
 * The social profiles the footer offers. The repository is known from the
 * release configuration; the rest arrive as environment configuration and are
 * offered only once they are set, so the footer never points at an account
 * that does not exist. Set NEXT_PUBLIC_SOCIAL_X_URL,
 * NEXT_PUBLIC_SOCIAL_LINKEDIN_URL or NEXT_PUBLIC_SOCIAL_YOUTUBE_URL to turn
 * the matching icon on.
 */
export type SocialProfile = {
  id: Extract<
    BrandIconName,
    "github" | "x" | "linkedin" | "youtube" | "facebook"
  >;
  label: string;
  url: string;
};

/** An empty variable is an unset profile, not a link to nowhere. */
function configured(url: string | undefined): string | undefined {
  const value = url?.trim();
  return value ? value : undefined;
}

const optional: Array<{
  id: SocialProfile["id"];
  label: string;
  url?: string;
}> = [
  {
    id: "x",
    label: "X",
    url: configured(process.env.NEXT_PUBLIC_SOCIAL_X_URL),
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    url: configured(process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL),
  },
  {
    id: "youtube",
    label: "YouTube",
    url: configured(process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL),
  },
  {
    id: "facebook",
    label: "Facebook",
    url: configured(process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL),
  },
];

export const socialProfiles: SocialProfile[] = [
  { id: "github", label: "GitHub", url: repositoryUrl },
  ...optional.filter((profile): profile is SocialProfile =>
    Boolean(profile.url),
  ),
];
